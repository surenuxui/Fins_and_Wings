PAYMENT QR CODE
1. Save your UPI QR code picture here as  payment-qr.png  (square, at least 600 x 600 px; .jpg/.webp also work).
   You can download it from your UPI app (Google Pay / PhonePe / Paytm: "My QR code" -> Share / Download).
2. In public/data/site-settings.json find "payment" and type your UPI ID in "upiId" (for example "shopname@bank").
   Leave "upiId" empty to hide the Copy / Open UPI app buttons.
3. Check "payeeName" - it is shown to the customer so they can confirm who they are paying.
Remove the whole "payment" block from site-settings.json to hide this section.
