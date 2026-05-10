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

@WebServlet("/ResumenVentasServlet")
public class ResumenVentasServlet extends HttpServlet {

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

        String fechaInicio = request.getParameter("fecha_inicio");
        String fechaFin = request.getParameter("fecha_fin");

        if (fechaInicio == null || fechaFin == null) {
            response.setStatus(400);
            out.print("{\"error\":\"Se requieren los parametros fecha_inicio y fecha_fin\"}");
            return;
        }

        String sql = "SELECT COUNT(*) AS total_facturas, " +
                     "COALESCE(SUM(total), 0) AS ingresos_totales, " +
                     "COALESCE(AVG(total), 0) AS promedio_por_factura " +
                     "FROM factura " +
                     "WHERE fecha_emision BETWEEN ? AND ? " +
                     "AND estado != 'anulada'";

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setString(1, fechaInicio);
            ps.setString(2, fechaFin);
            ResultSet rs = ps.executeQuery();

            if (rs.next()) {
                String json = "{" +
                    "\"fecha_inicio\":\"" + fechaInicio + "\"," +
                    "\"fecha_fin\":\"" + fechaFin + "\"," +
                    "\"total_facturas\":" + rs.getInt("total_facturas") + "," +
                    "\"ingresos_totales\":" + rs.getDouble("ingresos_totales") + "," +
                    "\"promedio_por_factura\":" + rs.getDouble("promedio_por_factura") +
                "}";
                out.print(json);
            }

            rs.close();
            ps.close();
            conn.close();

        } catch (Exception e) {
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}