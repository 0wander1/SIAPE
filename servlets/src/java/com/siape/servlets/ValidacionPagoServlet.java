package com.siape.servlets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Servlet que valida el estado de pago de una factura concreta.
 * Recibe el parámetro "id_factura" en la query string, ejecuta dos consultas
 * independientes (una a la tabla "factura" y otra a la tabla "pago"), calcula
 * el saldo pendiente y devuelve un objeto JSON con el resumen financiero de esa factura.
 */

// @WebServlet registra este servlet en Tomcat bajo la ruta "/ValidacionPagoServlet".
// El contenedor detecta la anotación al desplegar la aplicación y asocia cualquier
// petición GET a esa URL con el método doGet() de esta clase, sin necesidad de web.xml.
@WebServlet("/ValidacionPagoServlet")
public class ValidacionPagoServlet extends HttpServlet {

    // Cadena de conexión JDBC: especifica el driver (mysql), el host (localhost),
    // el puerto (3306) y el nombre de la base de datos (proyecto_siape).
    private static final String DB_URL = "jdbc:mysql://localhost:3306/proyecto_siape";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "1234";

    /**
     * Responde a peticiones HTTP GET. El cliente debe enviar el parámetro
     * "id_factura" en la query string, por ejemplo:
     *   /ValidacionPagoServlet?id_factura=42
     * Códigos de respuesta posibles:
     *   200 → consulta exitosa con JSON de resultado.
     *   400 → falta el parámetro id_factura.
     *   404 → no existe una factura con ese ID.
     *   500 → error interno (BD inaccesible, driver ausente, etc.).
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se declara la respuesta como JSON codificado en UTF-8 para que el navegador
        // interprete correctamente tildes y caracteres especiales del español.
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        // Cabecera CORS: permite que cualquier origen consuma este endpoint.
        // En producción se debe restringir al dominio del front-end del sistema SIAPE.
        response.addHeader("Access-Control-Allow-Origin", "*");

        // PrintWriter es el canal de escritura hacia el cuerpo de la respuesta HTTP.
        PrintWriter out = response.getWriter();

        // Se lee el parámetro "id_factura" de la query string de la URL.
        // request.getParameter() devuelve null si el parámetro no viene en la petición,
        // por eso se valida antes de intentar parsear o usar el valor.
        String idFactura = request.getParameter("id_factura");

        // Validación de presencia del parámetro obligatorio.
        // Si el cliente no lo envió se responde HTTP 400 (Bad Request) de inmediato,
        // y el "return" evita que el flujo continúe hacia las consultas a la BD.
        if (idFactura == null) {
            response.setStatus(400);
            out.print("{\"error\":\"Se requiere el parametro id_factura\"}");
            return;
        }

        // --- PRIMERA CONSULTA: datos de la factura ---
        // Recupera los campos clave de la factura identificada por su PK (id_factura).
        // El "?" es un marcador de posición que el PreparedStatement reemplaza de forma
        // segura con el valor real, impidiendo inyección SQL.
        String sqlFactura = "SELECT id_factura, numero_factura, total, estado FROM factura WHERE id_factura = ?";

        // --- SEGUNDA CONSULTA: total pagado para esa factura ---
        // Agrega todos los registros de la tabla "pago" que referencian esta factura
        // mediante la FK "factura_id_factura".
        // SUM(monto_pagado) suma cada pago registrado; COALESCE(..., 0) garantiza que
        // si la factura no tiene ningún pago asociado el resultado sea 0 y no NULL,
        // lo que evitaría un NullPointerException al leer el ResultSet.
        String sqlPagos = "SELECT COALESCE(SUM(monto_pagado), 0) AS total_pagado FROM pago WHERE factura_id_factura = ?";

        try {
            // Carga del driver MySQL Connector/J en el ClassLoader.
            // Desde JDBC 4.0 es opcional si el JAR está en el classpath, pero se
            // mantiene por compatibilidad con versiones anteriores de Tomcat.
            Class.forName("com.mysql.cj.jdbc.Driver");

            // Se abre una única conexión física que se reutiliza para ambas consultas,
            // evitando el coste de abrir y cerrar dos conexiones independientes.
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);

            // --- Ejecución de la primera consulta (factura) ---
            // Integer.parseInt() convierte el String recibido en la URL al tipo int
            // que corresponde a la PK entera de la tabla; setInt() lo vincula al "?".
            PreparedStatement psFactura = conn.prepareStatement(sqlFactura);
            psFactura.setInt(1, Integer.parseInt(idFactura));
            ResultSet rsFactura = psFactura.executeQuery();

            // rsFactura.next() intenta avanzar a la primera fila del resultado.
            // Si devuelve false la factura no existe en la BD: se responde HTTP 404,
            // se cierra la conexión para no dejar recursos abiertos y se sale con return.
            if (!rsFactura.next()) {
                response.setStatus(404);
                out.print("{\"error\":\"Factura no encontrada\"}");
                conn.close();
                return;
            }

            // Extracción de los campos de la factura desde el ResultSet.
            // Se usan los nombres de columna definidos en la SELECT para mayor claridad.
            double total         = rsFactura.getDouble("total");          // importe total facturado
            String estado        = rsFactura.getString("estado");         // p. ej. "pagada", "pendiente"
            String numeroFactura = rsFactura.getString("numero_factura"); // código alfanumérico visible

            // --- Ejecución de la segunda consulta (pagos acumulados) ---
            // Se reutiliza la misma conexión abierta y se vincula de nuevo el mismo idFactura.
            PreparedStatement psPagos = conn.prepareStatement(sqlPagos);
            psPagos.setInt(1, Integer.parseInt(idFactura));
            ResultSet rsPagos = psPagos.executeQuery();

            // La consulta de pagos siempre devuelve exactamente una fila (es una agregación
            // sin GROUP BY), por lo que se llama a next() sin comprobar su retorno.
            rsPagos.next();
            double totalPagado = rsPagos.getDouble("total_pagado");

            // --- Cálculo del saldo pendiente ---
            // La diferencia entre el total facturado y lo ya pagado indica cuánto
            // falta por cobrar. Un valor <= 0 significa que la factura está saldada
            // (podría ser negativo si se registró un pago en exceso por error).
            double saldoPendiente = total - totalPagado;

            // --- Construcción del JSON de respuesta ---
            // Se genera un único objeto JSON con todos los campos relevantes:
            //   id_factura          → identificador numérico de la factura (sin comillas, es int).
            //   numero_factura      → código legible (con comillas, es string).
            //   total               → importe total de la factura.
            //   total_pagado        → suma de todos los pagos registrados.
            //   saldo_pendiente     → diferencia calculada en Java (total - total_pagado).
            //   estado              → estado registrado en BD ("pagada", "pendiente", etc.).
            //   completamente_pagada → booleano Java derivado de saldoPendiente <= 0;
            //                          permite al front-end mostrar un indicador visual sin
            //                          necesitar recalcular en el cliente.
            String json = "{" +
                "\"id_factura\":" + idFactura + "," +
                "\"numero_factura\":\"" + numeroFactura + "\"," +
                "\"total\":" + total + "," +
                "\"total_pagado\":" + totalPagado + "," +
                "\"saldo_pendiente\":" + saldoPendiente + "," +
                "\"estado\":\"" + estado + "\"," +
                "\"completamente_pagada\":" + (saldoPendiente <= 0) +
            "}";

            out.print(json);

            // Cierre de recursos en orden inverso a su apertura.
            // Es importante cerrar primero los ResultSet, luego los PreparedStatement
            // y por último la Connection para liberar correctamente los recursos del driver.
            rsFactura.close();
            rsPagos.close();
            psFactura.close();
            psPagos.close();
            conn.close();

        } catch (Exception e) {
            // Captura cualquier excepción: ClassNotFoundException si falta el driver,
            // SQLException si la BD no responde o el SQL es inválido, y
            // NumberFormatException si id_factura no es un número entero válido.
            // En todos los casos se responde HTTP 500 con el mensaje de error en JSON.
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}