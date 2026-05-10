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

@WebServlet("/ValidacionPagoServlet")
public class ValidacionPagoServlet extends HttpServlet {

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

        String idFactura = request.getParameter("id_factura");

        if (idFactura == null) {
            response.setStatus(400);
            out.print("{\"error\":\"Se requiere el parametro id_factura\"}");
            return;
        }

        String sqlFactura = "SELECT id_factura, numero_factura, total, estado FROM factura WHERE id_factura = ?";
        String sqlPagos = "SELECT COALESCE(SUM(monto_pagado), 0) AS total_pagado FROM pago WHERE factura_id_factura = ?";

        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);

            PreparedStatement psFactura = conn.prepareStatement(sqlFactura);
            psFactura.setInt(1, Integer.parseInt(idFactura));
            ResultSet rsFactura = psFactura.executeQuery();

            if (!rsFactura.next()) {
                response.setStatus(404);
                out.print("{\"error\":\"Factura no encontrada\"}");
                conn.close();
                return;
            }

            double total = rsFactura.getDouble("total");
            String estado = rsFactura.getString("estado");
            String numeroFactura = rsFactura.getString("numero_factura");

            PreparedStatement psPagos = conn.prepareStatement(sqlPagos);
            psPagos.setInt(1, Integer.parseInt(idFactura));
            ResultSet rsPagos = psPagos.executeQuery();
            rsPagos.next();
            double totalPagado = rsPagos.getDouble("total_pagado");
            double saldoPendiente = total - totalPagado;

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

            rsFactura.close();
            rsPagos.close();
            psFactura.close();
            psPagos.close();
            conn.close();

        } catch (Exception e) {
            response.setStatus(500);
            out.print("{\"error\":\"" + e.getMessage() + "\"}");
        }
    }
}