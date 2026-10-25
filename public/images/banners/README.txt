CURRENT OFFER BANNERS
1. Save your banner picture here (landscape, 1600 x 533 px, 3:1; under 400 KB; .jpg/.png/.webp).
2. In public/data/site-settings.json find "banners" and put the file name in "image".
   Add more banners by copying the { ... } block (separate with a comma) - they slide automatically.
   "link" is where it goes when clicked: "#shop", "#delivery-check" or a full web address. Use "" for no link.
To remove a banner, delete its block. With no picture file or no blocks, the banner area is hidden.
Keep important text in the middle - on phones the edges are cropped slightly.

EXAMPLE - paste between the [ ] of "banners" in site-settings.json (it is empty until you add one):
    { "image": "offer-banner-1.jpg", "alt": "Diwali offer - 10% off fish food", "link": "#shop" }
