const midtransClient = require("midtrans-client");

exports.handler = async (event, context) => {
    // 1. Mengizinkan CORS agar frontend (React) bisa berkomunikasi dengan backend ini
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: "Method Not Allowed" };
    }

    try {
        // 2. Menangkap data pesanan yang dikirim dari LandingPage.tsx
        const { orderId, amount, name, email, phone, school } = JSON.parse(event.body);

        // 3. Inisiasi Midtrans (Pastikan Server Key diisi nanti)
        const snap = new midtransClient.Snap({
            isProduction: false, // Kita gunakan Sandbox (Mode Uji Coba)
            serverKey: "Mid-server-LZSZ7aaYWs4MiOws5JnGXAR-",
        });

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: parseInt(amount),
            },
            customer_details: {
                first_name: name,
                email: email,
                phone: phone,
            },
            item_details: [
                {
                    id: "INFAQ-ABDI",
                    price: parseInt(amount),
                    quantity: 1,
                    name: `Infaq Akses Premium - ${school}`,
                },
            ],
        };

        // 4. Meminta Token Transaksi ke Midtrans
        const transaction = await snap.createTransaction(parameter);

        // 5. Mengirimkan Token kembali ke Frontend
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ token: transaction.token }),
        };
    } catch (error) {
        console.error("Midtrans Error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message }),
        };
    }
};