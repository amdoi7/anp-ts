```
interface PaymentMethodData {
    supported_methods: "QR_CODE";
    data: {
        channel: "ALIPAY" | "WECHAT";
        qr_url: string;
        out_trade_no: string;
        expires_at: string;  // ISO-8601
    };
}
```