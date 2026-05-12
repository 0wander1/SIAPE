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
 * Servlet que expone un endpoint REST para obtener un resumen estadístico de ventas
 * dentro de un rango de fechas. Recibe "fecha_inicio" y "fecha_fin" como parámetros
 * de la URL y devuelve un objeto JSON con el total de facturas emitidas, los ingresos
 * acumulados y el ticket promedio por factura, excluyendo facturas anuladas.
 */

// @WebServlet registra este servlet en el contenedor Tomcat bajo la ruta "/ResumenVentasServlet".
// Cualquier petición HTTP que llegue a esa URL es enrutada automáticamente a esta clase,
// sin necesidad de declararlo en web.xml. El mapeo se resuelve en tiempo de despliegue.
@WebServlet("/ResumenVentasServlet")
public class ResumenVentasServlet extends HttpServlet {

    // URL JDBC que identifica el protocolo (mysql), el host, el puerto y el nombre de la BD.
    private static final String DB_URL = "jdbc:mysql://localhost:3306/proyecto_siape";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "1234";

    /**
     * Responde a peticiones HTTP GET. El cliente debe enviar los parámetros
     * "fecha_inicio" y "fecha_fin" en la query string, por ejemplo:
     *   /ResumenVentasServlet?fecha_inicio=2025-01-01&fecha_fin=2025-12-31
     * Si alguno falta, se responde HTTP 400. Si ocurre un error de BD, HTTP 500.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Se indica al cliente que la respuesta es JSON con codificación UTF-8,
        // asegurando la correcta interpretación de tildes y caracteres especiales.
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        // Cabecera CORS que permite que páginas de cualquier origen consuman este endpoint.
        // En un entorno productivo conviene reemplazar "*" por el dominio del front-end.
        response.addHeader("Access-Control-Allow-Origin", "*");

        // Canal de escritura hacia el cuerpo de la respuesta HTTP.
        PrintWriter out = response.getWriter();

        // Lectura de parámetros de la URL (query string).
        // request.getParameter() devuelve null si el parámetro no fue enviado,
        // por lo que se valida antes de continuar para evitar errores en la consulta.
        String fechaInicio = request.getParameter("fecha_inicio");
        String fechaFin    = request.getParameter("fecha_fin");

        // Validación de presencia de parámetros obligatorios.
        // Si falta cualquiera de los dos, se responde HTTP 400 (Bad Request) con un
        // mensaje descriptivo y se corta la ejecución con "return" para no continuar.
        if (fechaInicio == null || fechaFin == null) {
            response.setStatus(400);
            out.print("{\"error\":\"Se requieren los parametros fecha_inicio y fecha_fin\"}");
            return;
        }

        // Consulta SQL con tres funciones de agregación aplicadas sobre la tabla "factura":
        //   - COUNT(*): cuenta todas las filas que cumplan el filtro, es decir, el número
        //     de facturas emitidas en el rango. El alias "total_facturas" nombra la columna
        //     en el ResultSet.
        //   - SUM(total): suma los montos de todas las facturas del período. COALESCE(..., 0)
        //     garantiza que si no hay filas el resultado sea 0 en lugar de NULL, evitando
        //     un NullPointerException al leer el ResultSet.
        //   - AVG(total): calcula el promedio del monto por factura. También protegido con
        //     COALESCE para el caso de período vacío.
        // BETWEEN ? AND ? filtra por el rango de fechas; los "?" son marcadores de posición
        // que se sustituyen con valores seguros en el PreparedStatement (evita SQL injection).
        // AND estado != 'anulada' excluye facturas canceladas para no distorsionar los totales.
        String sql = "SELECT COUNT(*) AS total_facturas, " +
                     "COALESCE(SUM(total), 0) AS ingresos_totales, " +
                     "COALESCE(AVG(total), 0) AS promedio_por_factura " +
                     "FROM factura " +
                     "WHERE fecha_emision BETWEEN ? AND ? " +
                     "AND estado != 'anulada'";

        try {
            // Registro explícito del driver MySQL. Desde JDBC 4.0 es opcional si el JAR
            // del conector está en el classpath, pero se conserva por compatibilidad.
            Class.forName("com.mysql.cj.jdbc.Driver");

            // Abre la conexión física con la BD usando las credenciales definidas como constantes.
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);

            // PreparedStatement compila la consulta en el servidor de BD y enlaza los "?"
            // con los valores reales mediante setString(), lo que previene inyección SQL
            // porque el driver trata los valores como datos, nunca como instrucciones SQL.
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setString(1, fechaInicio); // sustituye el primer  "?" → fecha_emision >= fechaInicio
            ps.setString(2, fechaFin);    // sustituye el segundo "?" → fecha_emision <= fechaFin

            // executeQuery() envía la consulta al servidor y retorna un ResultSet (cursor).
            // Como la consulta usa solo funciones de agregación sin GROUP BY, siempre
            // devolverá exactamente una fila (aunque no haya facturas en el período).
            ResultSet rs = ps.executeQuery();

            // rs.next() avanza el cursor a la primera (y única) fila.
            // Se usa "if" en lugar de "while" porque la agregación produce una sola fila.
            // Si por algún motivo el ResultSet llegara vacío, el bloque se omite sin error.
            if (rs.next()) {
                // Construcción del JSON de respuesta como un único objeto "{...}".
                // Se incluyen las fechas del rango recibidas en los parámetros para que el
                // cliente pueda confirmar el período al que corresponde el resumen.
                // rs.getInt() y rs.getDouble() extraen los valores por el alias definido en SQL.
                String json = "{" +
                    "\"fecha_inicio\":\"" + fechaInicio + "\"," +
                    "\"fecha_fin\":\"" + fechaFin + "\"," +
                    "\"total_facturas\":" + rs.getInt("total_facturas") + "," +
                    "\"ingresos_totales\":" + rs.getDouble("ingresos_totales") + "," +
                    "\"promedio_por_factura\":" + rs.getDouble("promedio_por_factura") +
                "}";
                out.print(json);
            }

            // Cierre de recursos en orden inverso: ResultSet → PreparedStatement → Connection.
            // Liberar la conexión es crítico para devolver el socket a la BD y evitar fugas.
            rs.close();
            ps.close();
            conn.close();

        } catch (Exception e) {
            // Ante cualquier excepción (driver ausente, credenciales incorrectas, SQL inválido,
            // timeout de red, etc.) se retorna HTTP 500 con el mensaje de error en JSON.
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}