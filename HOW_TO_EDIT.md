# How to edit your website (no coding needed)

Everything you change lives in **two folders**: `public/data` (words, prices, products) and `public/images` (photos).
Never touch the `src` folder.

## 1. Products — `public/data/products.csv`
Open it in **Excel or Google Sheets**. One row = one product.

| Column | What to type |
|---|---|
| name | Product name |
| category | Pick a name from `categories.csv` (e.g. `Fish Food`) |
| price / original price | Numbers only. Fill *original price* to show a strike-through offer |
| options | Sizes the customer can choose, separated by `;` — see section 1a |
| option name | Optional. Overrides the heading (Weight, Length, Power, Volume…) set per category |
| stock | Any words, e.g. `In stock`, `Limited stock` |
| description | One short sentence |
| image | File name of the photo (see below). Leave blank to use auto-naming |
| badge | Small label on the photo, e.g. `OFFER`, `NEW` |
| featured | `yes` to show it first |
| live … visit shop only | `yes` for live fish / live plants. They get a **Visit Shop Only** tag and no delivery |
| show on website | `no` hides the row without deleting it |

**Add** a product = add a row. **Remove** = delete the row (or set *show on website* to `no`).
When saving, choose **CSV UTF-8** (Excel) or *File → Download → CSV* (Google Sheets). Keep the same file name.

### 1a. Sizes / length / watts / ml (options)
Type them in the **options** cell as `name=price`, separated by semicolons:
- Food: `100g=149; 200g=279; 500g=649`
- Aquarium, stand, light (length): `10 inch=399; 1 feet=599; 2 feet=1099`
- Filter, motor, heater (power): `4W=799; 15W=1199`
- Medicine: `100ml=190; 150ml=265`

The customer picks from a dropdown; the price, quantity total and WhatsApp message follow the choice. Add `|old price` for a strike-through (`100g=149|175`). Leave the options cell empty for a product with one size (the *price* column is used). The heading above the dropdown comes from the category's **option name** in `categories.csv`.
Rows with a bad price are hidden; open the site with `?check` to see why.

## 2. Categories — `public/data/categories.csv`
Columns: `id` (lowercase, no spaces, e.g. `fish-food`), `name`, `option name` (heading for the size dropdown: Weight, Length, Power, Volume, Size…), `image`.
To add a category: add a row here **and** create a matching folder `public/images/products/<id>/`.

## 3. Photos — `public/images`
```
images/
  site/            hero.jpg  promo.jpg  feature.jpg  about.jpg  enquiry.jpg   (big page pictures)
  categories/      fish-food.jpg  aquariums.jpg …                            (one per category id)
  products/
    fish-food/     osaki-basic-fish-food-100g.jpg …                          (one folder per category)
    aquariums/     …
```
Two easy ways to add a product photo:
1. **Auto:** save the photo as the product name in lowercase with dashes — `Premium Tropical Flakes` → `premium-tropical-flakes.jpg` — inside its category folder. Leave the *image* cell empty.
2. **Manual:** put the photo in the category folder and type its file name (`flakes.jpg`) in the *image* cell.

Tips: lowercase names, no spaces, `.jpg` `.png` or `.webp`, about 800 px wide, under 300 KB.
A web link (`https://…`) also works in the image cell. If a photo is missing, a neat "Photo coming soon" picture is shown — nothing breaks.

## 3a. Current offer banner
Save the picture in `public/images/banners/` (1600 × 533 px), then list it under `"banners"` in `site-settings.json`. Several banners slide automatically; no banner = the area disappears. Details: `public/images/banners/README.txt`.

## 3b. Payment QR code ("Scan to pay", next to Terms & Conditions)
1. Download your UPI QR picture from your payment app and save it as `public/images/payment/payment-qr.png`.
2. In `site-settings.json`, under `"payment"`, type your UPI ID in `"upiId"` (e.g. `"shopname@bank"`) and check `"payeeName"`.
3. Customers can tap the QR to enlarge it, copy the UPI ID, save the QR, and (on phones) open their UPI app.
Leave `"upiId"` empty to hide the copy / open-app buttons. Delete the whole `"payment"` block to hide the section. Until the QR picture exists, a "coming soon" message is shown.

## 4. Words on the site — `public/data/site-settings.json`
Change only the text between quote marks. Keep every `"`, `,`, `[` and `]`.
Numbers in the texts can be typed as `{freeDeliveryAbove}`, `{maxDistanceKm}`, `{baseFee}` and `{perKmFee}` — they are filled in from `delivery-config.json`, so the words on the site can never disagree with the real delivery fee.
Sections: shop details, menu (`nav`), hero, **`usp`** (the four selling points under the hero), offer, feature, delivery text, about, enquiry options, policies.
If you make a typing mistake, the page shows a clear message naming the file. Open the site with `?check` on the end of the address (e.g. `…/?check`) to see warnings about rows that are hidden.

## 5. Delivery checker — `public/data/delivery-config.json`
- **Rules:** `freeDeliveryAbove` (order amount for free delivery), `freeDeliveryMaxKm` (free delivery only inside this distance), `maxDistanceKm` (furthest we deliver), `baseFee` and `perKmFee`. Change the numbers; the site text updates itself.
  Example: `freeDeliveryMaxKm` 10 and `maxDistanceKm` 20 means orders above the free amount are free up to 10 km, and from 10 km to 20 km delivery is always charged (`baseFee + perKmFee × km`, rounded up) whatever the order amount. Beyond 20 km the customer is asked to contact the shop.
- **Shop location (required once):** `latitude` and `longitude` are empty on purpose — they must be your *verified* spot.
  Easiest: run the site, add `?setup=1` to the address, zoom in, **click the shop door**, and copy the two numbers shown into the file.
  (Or in Google Maps right-click the shop → click the numbers to copy.) Until this is done, customers see a polite "being set up" message.
- **Map/route providers:** the free public OpenStreetMap, Nominatim (search) and OSRM (routing) servers are used. They are fine for a small shop, but have no uptime guarantee. For heavy use, put a paid/self-hosted provider's address in `providers` (see `src/delivery/providers.ts`, the only file to change).

## 6. Run / publish
- Preview: `npm install` once, then `npm run dev`.
- Check the pricing logic: `npm test`.
- Publish: `npm run build`, upload the `dist` folder. After that, you can edit files in `data/` and `images/` **directly on the host** — no rebuild needed.
