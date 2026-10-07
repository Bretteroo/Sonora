"""Every product picture play.sonos.com holds, by title.

Read off the web app on 2026-09-24. Its View System Details asks its own
server, ``play.sonos.com/api/sanity``, for

    *[_type=="sanity.imageAsset" && "setup-carousel-image" in
      opt.media.tags[]->name.current]{_id,title,url}

and gets these 91 assets of Sonos' content store (Sanity project znqtjj88,
dataset "int"). That store is private: the same query sent to Sanity's own
API without the web app's credential finds no assets at all. The pictures
themselves are public at media.sonos.com under the file names below, so
this list is what Sonora keeps and ``products.py`` fetches from.

A title is the model numbers a picture shows, joined by "-", then "_" and
the color: "S31-S32_black" is the Beam in black, "S1-S12_white" the Play:1
in white. A file name carries the picture's own hash and size, so a name
never changes what it points at.

To bring the list up to date, run the query above in the web app's console
while signed in and replace these rows with its titles and file names.
"""

#: title -> file name under media.sonos.com/images/znqtjj88/int/
PICTURES: dict[str, str] = {
    "BR200_white": "9651baaa24662c0411ee60eb58a9eda43e4fc5b5-828x828.png",
    "S1-S12_black": "75936ec7ec89e1a2ac186c66230b0da2e54867c2-828x828.png",
    "S1-S12_white": "d9e159df4669efe00c04a75b55b48022d0e48ed1-828x828.png",
    "S11_black": "a1a3494ae26cb691aaf814d17387a04a04598c84-828x420.png",
    "S11_white": "c9da1ea082c72c5dff73140882e4446271f60028-828x420.png",
    "S13-S18_black": "3d51c32146f232177a5c77fcef9c0b1fe25e90cf-828x828.png",
    "S13-S18_limited": "c434df5894f7b0d14a500350b6c4ef5f63245989-828x828.png",
    "S13-S18_white": "6a0a4ebc4bc8d059a2edb028f0756cc94a294ca9-828x828.png",
    "S14_black": "cbb6ae020291e84a5052abacd95397645bef9a66-828x420.png",
    "S14_shadow": "34dc7690fac7b73b3ccc803be762f6dd10b97048-828x420.png",
    "S14_white": "16072856db480aeb12cb669849949b7780700f65-828x420.png",
    "S15_white": "dec57aec6b359daf0f698b1683d508f8ddc7b6b1-828x828.png",
    "S16_black": "5a7967abfc984a30b218dd659c57bfc4ea634709-818x600.png",
    "S17_black": "92703d68d3c4a39c7067a870c7900a40f80247c3-828x828.png",
    "S17_lunar": "6baff7ef2f72b00720d4a1d7f168d3593957cc3f-828x828.png",
    "S19_black": "e955cb99502840d7213fec839d0da6e7498d6519-828x420.png",
    "S19_white": "ae095c921282ce166227232c995732cea8e0ea32-828x420.png",
    "S20_black": "8a5bdeb324ef65eec5e8805f46e92523017b3b2d-828x828.png",
    "S20_white": "cd41ed301413a57deb933a7dd0e8c2bf4912ab2e-828x828.png",
    "S21_black": "e5769af3fe3c1aa9b28fe5a65ffee725fcf7127e-828x828.png",
    "S21_white": "445d4c037e9c9301c1fc665eaf1a5c6002d0f9c0-828x828.png",
    "S22-S38-S43_black": "93c61f6e1ffb97dfc4e1e0180295da83f5a1e0a4-828x828.png",
    "S22-S38-S43_shadow": "b07e2dde159ee760dac493c5d4de471bb3467612-828x828.png",
    "S22-S38-S43_white": "8b7f43e3cb214507de8b4cc55ea5012c0c395f83-828x828.png",
    "S23_black": "38e2dda5de2518021f0aab8b25fa71cb6d3ecf75-818x600.png",
    "S24_black": "37a7f0d22634b9adb2391623b259390ed97cc888-828x828.png",
    "S24_white": "ba9e2503082825ca8453757fdd62b581af3912f1-828x828.png",
    "S27_lunar": "552119971f8b2e124b85e4a0a5879486082abf96-828x828.png",
    "S27_olive": "d7499095f78537030c5ba5a4e6302501ccf02703-828x828.png",
    "S27_shadow": "263bd702fe8aaff45f077e99f92978a9c45e7141-828x828.png",
    "S27_sunset": "2f03c4d2d7fb863b473d43f5cdbd4d07daf4e1d3-828x828.png",
    "S27_wave": "149db3ab67865569a304402e256763696b176fa2-828x828.png",
    "S29_black": "3ced50852fad79c1e454470a7a310b996690af7a-828x828.png",
    "S29_white": "02b03d9345d2be810fa9dc1103862634d8cdbc3e-828x828.png",
    "S30_black": "e877dc04040c63ae97e78ac6625773ddead34dc2-828x828.png",
    "S30_white": "858183c260d69a0d36e34bdebebe0a37370b4538-828x828.png",
    "S31-S32_black": "0d3211924da8f753be0e4fb56c76587f82364752-828x420.png",
    "S31-S32_shadow": "248e53bfee89c6caccd6315d295e1a228bdeccab-828x420.png",
    "S31-S32_white": "a77987ffc71efd810d421b69b3e1f5887ccdd370-828x420.png",
    "S33_black": "ac82a0292b17dfcd406b1906bdb57162ef26be35-828x828.png",
    "S33_white": "53ccdb67687751846dd82d4470eb7b140a14f20d-828x828.png",
    "S34_shadow": "406dd8e9a5b916dc60abfcd12ea1565bfd9869fb-828x420.png",
    "S35_lunar": "b9d252d393a4d0008bbaa6fa736f36dc8260e1e3-828x828.png",
    "S35_olive": "e2c697e12aa09094821f37905cdb1590e781c851-828x828.png",
    "S35_shadow": "5c93c79725409d17c723ba9f59777fe4336c8d8a-828x828.png",
    "S35_sunset": "7a9b45b8a74e401f68a37ba1a370d41c5607edf3-828x828.png",
    "S35_wave": "efa76848c8d926522e5b1b60c17ec925a58c1047-828x828.png",
    "S36_black": "e88a729266206d2185ecd59e3fcec756bd52c4c2-828x420.png",
    "S36_white": "fcf850ee0d7227be6b6576eb8437d7295a3e3d42-828x420.png",
    "S37_black": "33a63d3a14f55225b0c5b7441348b76e0313fd7d-828x828.png",
    "S37_white": "7202ec7e70732f724bc30c2b28069d9468923c27-828x828.png",
    "S39-S57_black": "8a41d4c22edc19c7274e3e8152ecc621ad237c37-828x828.png",
    "S39-S57_white": "b14d271ffc10f0787ae22be2f11a6dcacef32b6b-828x828.png",
    "S3_black": "838c36fea9e318931273c9bac5b8e8e0b8a21e1a-828x828.png",
    "S3_white": "8e9a8fb393812e5b2b5be136d58391a876be0030-828x828.png",
    "S41_black": "32143e49387dd51b37691bc7e719d3be411acd80-828x828.png",
    "S41_white": "c1deb7f76ad15295cc8410632b5ae34768d6ce99-828x828.png",
    "S42_black": "012cc7f19f3ecba3c7563ff8f4a0d324b8459c07-828x828.png",
    "S44_black": "4bea8865d6a1b1619c3742e9f390b6f856f4c950-828x828.png",
    "S44_olive": "cfada1f2b850c9006a08c9f9ba847363348f2f9b-828x828.png",
    "S44_white": "4317f3e0eecdea6f33b5398691ab6f53fd5b52e6-828x828.png",
    "S45_black": "863c688bc0c34d8351ffeeeb2e9836c460c16e41-828x420.png",
    "S45_white": "f028ace7b5fc6c0e738ceb09f3689bfaa1683747-828x420.png",
    "S48_black": "34e5a68192a8d22bd0430a142eba79b66b4be9f6-828x828.png",
    "S48_white": "8a3cc6f5e1f9b6f7f980d48e2f1049e6022bfa33-828x828.png",
    "S49_black": "9ea75686dfca99f5c83576409c9ffe4e1ec1265c-828x828.png",
    "S49_greige": "6ef78ea8711d99a05bc8f0ccf60971b08bf64eae-828x828.png",
    "S51_black": "8b627b34cd4aa697943a47313c5983eec62a80f9-750x750.png",
    "S54_black": "06d9781df5058ae2125607572fbb4c01b3e270d5-828x828.png",
    "S54_olive": "d67e976e38db30e3186788ae1b43c0377460e021-828x828.png",
    "S54_sunset": "ca567fe2e39c849df142c6e81fb7e677cb704e57-828x828.png",
    "S54_wave": "962af97b47c0ad1c1cc81000874c1a5312a82ee2-828x828.png",
    "S54_white": "edcdc184a7c847842e60dad9da3c424c2d00a1a9-828x828.png",
    "S55_black": "b909b56db7f5dc8bb1eb4b973a78c88e30acab84-828x828.png",
    "S55_white": "15394ad867e5874ec955c63eafb716e8c0268942-828x828.png",
    "S58_black": "351b782ca3344c038816ec18b0bda7b452195c3a-828x828.png",
    "S58_blush": "27441408aeb45fba54e416135d35ea7cde0e77a9-828x828.png",
    "S58_sand": "92055f9dd25bcd16a5b3d763e8f255cfe00e1a3d-828x828.png",
    "S58_white": "08790661168815d4f78396ca1c56dd4daa5ce1a4-828x828.png",
    "S59_black": "d0234032c1179a9cb196004dde56c207776c1c26-828x420.png",
    "S59_white": "fbdf8095893dceb3f0dcabaca66acc3a6d62d089-828x420.png",
    "S5_black": "fa714d554c185ed10752a23ac6fe5f81e4c5b1e1-828x828.png",
    "S5_white": "a1b816118b5000a9eced95380335f8554335da9f-828x828.png",
    "S62_black": "e383999a78c1d2f58be8c53ced4b341df0afd80b-828x828.png",
    "S62_white": "2568ffadb9a58ff2e5a456782aa15d5399dfbb58-828x828.png",
    "S6_black": "457f67ceef7a996b5a726fefa63900f4674b5604-828x828.png",
    "S6_white": "496b1afa6dbc809962a234e4c7c10fde88caf928-828x828.png",
    "S9_black": "290b14467a83a925f7bf4fc519a88f3cc8f1784e-828x420.png",
    "Sub-S26_black": "9f93154408810a9ceb79d8b9b5b4d6adadaac513-828x828.png",
    "Sub-S26_white": "564ea6bd6b17a5cc03cea4e3f312f38ee1507391-828x828.png",
    "ZP120_white": "48c7e490d8ccecdb6f51ff42c40356b24ef468a2-828x828.png",
}
