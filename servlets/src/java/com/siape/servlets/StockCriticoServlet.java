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

@WebServlet("/StockCriticoServlet")
public class StockCriticoServlet extends HttpServlet {

    private static final String DB_URL = "jdbc:mysql://localhost:3306/proyecto_siape";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "1234";

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.addHeader("Access-Control-Allow-Origin", "*");

        PrintWriter out = response.getWriter();

        String sql = "SELECT p.nombre_producto, i.cantidad_disponible, i.cantidad_minima, " +
                     "(i.cantidad_minima - i.cantidad_disponible) AS deficit, " +
                     "b.descripcion AS bodega " +
                     "FROM inventario i " +
                     "JOIN producto p ON i.producto_id_producto = p.id_producto " +
                     "JOIN bodega b ON i.bodega_id_bodega = b.id_bodega " +
                     "WHERE i.cantidad_disponible < i.cantidad_minima " +
                     "ORDER BY deficit DESC";

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement ps = conn.prepareStatement(sql);
            ResultSet rs = ps.executeQuery();

            StringBuilder json = new StringBuilder("[");
            boolean first = true;

            while (rs.next()) {
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

            json.append("]");
            out.print(json.toString());

            rs.close();
            ps.close();
            conn.close();

        } catch (Exception e) {
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}