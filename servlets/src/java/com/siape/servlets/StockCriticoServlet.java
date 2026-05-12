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
 * Servlet que expone un endpoint REST para consultar los productos con stock crítico,
 * es decir, aquellos cuya cantidad disponible en inventario es menor que la cantidad mínima
 * definida. Devuelve la lista ordenada por déficit descendente en formato JSON.
 */

// @WebServlet mapea esta clase al URL "/StockCriticoServlet" dentro del contexto de la aplicación.
// Cuando el servidor Tomcat recibe una petición HTTP a esa ruta, instancia y delega en este servlet.
// Es el equivalente a declarar el servlet en web.xml, pero de forma directa sobre la clase.
@WebServlet("/StockCriticoServlet")
public class StockCriticoServlet extends HttpServlet {

    // Cadena de conexión JDBC: protocolo "jdbc:mysql", host "localhost", puerto 3306 y nombre de la BD.
    private static final String DB_URL = "jdbc:mysql://localhost:3306/proyecto_siape";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "1234";

    /**
     * Maneja peticiones HTTP GET. Es invocado automáticamente por el contenedor de servlets
     * cada vez que el cliente (el navegador o JavaScript del front-end) realiza un GET a
     * "/StockCriticoServlet". No recibe parámetros de consulta; simplemente ejecuta la
     * consulta y retorna el JSON con los productos en stock crítico.
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        // Indicamos al cliente que la respuesta es JSON codificado en UTF-8.
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        // Cabecera CORS: permite que cualquier origen (dominio) consuma este endpoint.
        // En producción se debería restringir al dominio del front-end.
        response.addHeader("Access-Control-Allow-Origin", "*");

        // PrintWriter es el canal de salida del servlet; todo lo que se escriba aquí
        // llega al cuerpo de la respuesta HTTP que recibe el cliente.
        PrintWriter out = response.getWriter();

        // Consulta SQL con tres tablas unidas:
        //   - inventario (i): contiene cantidades disponibles y mínimas por bodega.
        //   - producto (p): aporta el nombre legible del producto.
        //   - bodega (b): aporta la descripción de la bodega donde está el stock.
        // La columna calculada "deficit" = cantidad_minima - cantidad_disponible indica
        // cuántas unidades faltan para alcanzar el mínimo requerido.
        // El filtro WHERE garantiza que solo se devuelven filas realmente críticas.
        // ORDER BY deficit DESC coloca primero los productos con mayor urgencia de reabastecimiento.
        String sql = "SELECT p.nombre_producto, i.cantidad_disponible, i.cantidad_minima, " +
                     "(i.cantidad_minima - i.cantidad_disponible) AS deficit, " +
                     "b.descripcion AS bodega " +
                     "FROM inventario i " +
                     "JOIN producto p ON i.producto_id_producto = p.id_producto " +
                     "JOIN bodega b ON i.bodega_id_bodega = b.id_bodega " +
                     "WHERE i.cantidad_disponible < i.cantidad_minima " +
                     "ORDER BY deficit DESC";

        try {
            // Carga explícita del driver MySQL Connector/J en el ClassLoader.
            // A partir de JDBC 4.0 esto es opcional si el JAR está en el classpath,
            // pero se mantiene por compatibilidad con entornos más antiguos.
            Class.forName("com.mysql.cj.jdbc.Driver");

            // Abre una conexión física con la base de datos usando las credenciales definidas.
            // DriverManager selecciona el driver adecuado según el prefijo "jdbc:mysql".
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);

            // PreparedStatement compila la consulta SQL en el servidor de BD,
            // lo que es más seguro y eficiente que un Statement plano.
            PreparedStatement ps = conn.prepareStatement(sql);

            // Ejecuta la consulta y obtiene un cursor (ResultSet) que apunta antes
            // de la primera fila. Cada llamada a rs.next() lo avanza una posición.
            ResultSet rs = ps.executeQuery();

            // Construcción manual del JSON como arreglo "[ {...}, {...}, ... ]".
            // Se usa StringBuilder para concatenar de forma eficiente en lugar de String +.
            StringBuilder json = new StringBuilder("[");
            // "first" controla si hay que insertar una coma separadora antes del objeto actual.
            boolean first = true;

            // Se recorre el ResultSet fila por fila hasta que no haya más resultados.
            // rs.getString() y rs.getDouble() extraen el valor de la columna indicada por nombre.
            while (rs.next()) {
                // A partir del segundo objeto se agrega la coma que separa elementos JSON.
                if (!first) json.append(",");
                json.append("{")
                    .append("\"producto\":\"").append(rs.getString("nombre_producto")).append("\",")
                    .append("\"disponible\":").append(rs.getDouble("cantidad_disponible")).append(",")
                    .append("\"minimo\":").append(rs.getDouble("cantidad_minima")).append(",")
                    .append("\"deficit\":").append(rs.getDouble("deficit")).append(",")
                    .append("\"bodega\":\"").append(rs.getString("bodega")).append("\"")
                    .append("}");
                first = false;
            }

            // Cierra el arreglo JSON y lo envía al cliente como cuerpo de la respuesta.
            json.append("]");
            out.print(json.toString());

            // Libera los recursos de BD en orden inverso a su apertura (ResultSet → Statement → Connection).
            rs.close();
            ps.close();
            conn.close();

        } catch (Exception e) {
            // Ante cualquier error (driver no encontrado, BD inaccesible, SQL inválido, etc.)
            // se devuelve HTTP 500 con un objeto JSON que describe el mensaje de la excepción.
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}