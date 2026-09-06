# SKYBOUND — Web Uçuş Simülatörü

GPT 6 Astra ile 2 promtta yapılmış web arayüzünde çalışan uçuş simülasyonu.

Three.js ile geliştirilmiş, gerçek uydu görüntüleri ve gerçek arazi yükseklikleri üzerinde çalışan 3B uçuş oyunu. Göcek kıyılarından, Dalaman pistinden, Toros Dağları üzerinden veya dünya haritasında seçtiğin bir noktadan başlayabilirsin. Hesap, API anahtarı veya `.env` ayarı gerekmez.

## Çalıştırma

Node.js 20.19+ veya 22.12+ gerekir.

```bash
npm install
npm run dev
```

Terminalde verilen yerel adresi aç. WebGL 2 ve donanım hızlandırması destekleyen modern bir tarayıcı kullan.

```bash
npm run build   # Yayına hazır dosyalar: dist/
npm run preview # Derlenmiş sürümü yerel olarak aç
npm start       # Üretim sunucusu: http://localhost:4173
npm test        # Uçuş, koordinat, yükseklik ve harita servisi testleri
```

Geliştirme ve önizleme sunucusu, açık yükseklik verisini otomatik iletir. Yayınlamak için `npm run build` sonrasında `npm start` çalıştır; `PORT` ortam değişkeniyle sunucu portunu seçebilirsin. Üretim sunucusu `dist/` dosyalarıyla birlikte `/map-tiles/elevation/…` yolunu da sunar. Yalnızca `dist/` klasörünü statik bir sunucuya kopyalamak yükseklik servisinin çalışması için yeterli değildir.

Harita ve uydu parçaları internet üzerinden, bulunduğun bölgeye göre yüklenir. Yükseklik kaynağı tarayıcı CORS başlıkları sağlamadığı için projedeki dar kapsamlı sunucu yolu kullanılır; bu yol yalnızca geçerli açık yükseklik parçalarını ister, API anahtarı kullanmaz. Tarayıcı HTTP önbelleği, sınırlı bellek önbelleği ve altı eşzamanlı istek sınırı gereksiz indirmeleri azaltır. Eksik veride sahte araziye geçilmez: durum ve yeniden deneme düğmesi gösterilir; uçağın altındaki yükseklik verisi hazır değilse uçuş duraklatılır.

Arayüz fontları Google Fonts'tan yüklenir; bağlantı yoksa sistem fontlarına geçer.

## Gerçek dünya haritası

Navigasyon panelindeki büyütme düğmesiyle dünya haritasını aç. Fareyle sürükle, tekerlek veya +/− düğmeleriyle yakınlaştır. **Harita / Uydu** düğmeleriyle katmanı değiştir. Bir noktaya tıkla, **Buradan uç** düğmesini kullan ve arazi hazır olduğunda uçuşa başla. **Uçağa dön** düğmesi konumunu tekrar merkeze alır.

Uçak konumu, izlenen uçuş izi, Dalaman hedefi, uydu döşemeleri ve arazi yüksekliği aynı coğrafi dönüşümü kullanır. Büyük harita tekrar açıldığında kaynakları temiz biçimde oluşturulur; küçük harita uçağı takip eder. Uydu görüntüleri üç boyutlu arazi üzerine kaplanır; binalar ayrı fotogrametri modelleri değildir. Dünya genelinde seçim yapılabilir; uçuş fiziğindeki yerel metre ölçeği Dalaman bölgesine göre ayarlıdır ve başka enlemlerde mesafeler yaklaşık olur.

## Kontroller

| Tuş | İşlev |
| --- | --- |
| Enter | Uçuşa başla |
| ↑ / ↓ | Tırman / alçal |
| ← / → veya A / D | Sola / sağa yatış |
| W / S veya + / − | Gaz artır / azalt |
| Q / E | Dümen |
| P | Duraklat / devam et |
| C | Takip / kokpit / sinematik kamera |
| G | İniş takımı |
| F | Flaplar |
| Z | Yön ve irtifayı koruyan otopilot |
| B | Pistte fren |
| R | Seçili rotayı yeniden başlat |
| M | Motor sesi |
| H | Kontrol rehberi |

Mobil ekranda uçuş başladıktan sonra yön düğmeleri görünür; gaz kolu ve alt çubuktaki uçak sistemi düğmeleri dokunmayla kullanılabilir. Uçuş kontrolü bırakıldığında uçak yavaşça dengelenir. Başka bir sekmeye geçildiğinde uçuş otomatik duraklar.

Kalkış: Dalaman rotasını seç, gazı %100 aç, en az 65 KTS hızda ↑ ile kalk ve kıyıdaki yükselen araziyi aşana kadar tırmanmaya devam et. İniş: Pist yönüne hizalan, iniş takımı ve flapları aç, gazı azaltıp 55–85 KTS hızla yavaşça alçal. Piste indikten sonra gazı sıfırla ve B ile fren yap.

## Özellikler

- Esri uydu görüntüleriyle kaplı gerçek kıyılar, şehirler, dağlar ve adalar.
- Mapzen Terrain Tiles verisinden gerçek yükseklik ve aynı veriye dayalı çarpışma.
- S62 çift pervaneli uçak, hareketli pervaneler ve iniş takımları, üç gövde rengi.
- Hava hızı, irtifa, yön, dikey hız, motor devri, gaz ve yakıt göstergeleri.
- OpenStreetMap / uydu katmanlı, yakınlaştırılabilir ve sürüklenebilir Leaflet haritası; konum, rota ve uçuş izi.
- Gün batımı, açık gökyüzü ve bulutlu hava seçenekleri.
- Hıza tepki veren motor sesi; yerel olarak kaydedilen görünüm ve ses tercihleri.
- Stall, arazi ve su çarpışması, pistten kalkış, yumuşak iniş ve frenleme.

Uçuş fiziği oyun deneyimi için sadeleştirilmiştir; gerçek dünya navigasyonu veya uçuş eğitimi amacı taşımaz. Microsoft Flight Simulator'dan esinlenen bağımsız bir projedir; Microsoft'a ait varlıkları veya markalamayı kullanmaz.

## Veri kaynakları

- Yol haritası: [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Tarayıcı istekleri [OSM döşeme kullanım politikasına](https://operations.osmfoundation.org/policies/tiles/) uygun normal önbellekle çalışır; toplu veya çevrimdışı indirme özelliği yoktur.
- Uydu: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9), Esri / Maxar / Earthstar Geographics / GIS User Community. Kaynak atıfları hem sahnede hem uydu haritasında görünür.
- Yükseklik: [Mapzen Terrain Tiles / AWS Open Data](https://registry.opendata.aws/terrain-tiles/) ve [veri kaynaklarının atıfları](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). Dalaman bölgesinde EU-DEM; diğer bölgelerde kaynağa göre SRTM ve diğer açık yükseklik verileri.
- Pist: [DHMİ Dalaman Havalimanı haritası](https://www.dhmi.gov.tr/AIPDocuments/LT_AD_2_LTBS_ADC_en.pdf), 3.000 × 45 m, gerçek yön 15,35°, merkez yaklaşık 36,7131° N / 28,7925° E. Görüntüdeki pist uydu kaynağından gelir.

Bu açık erişimli servisler internet bağlantısına ve sağlayıcıların erişilebilirliğine bağlıdır.

## Dosya düzeni

- `src/main.js`: Türkçe arayüz, girişler, pencereler, ses ve oyun döngüsü.
- `src/world.js`: Three.js dünya, uçak, ışık ve kameralar.
- `src/earth.js`: Uçuş konumuna göre uydu ve yükseklik parçalarını yükleyen 3B arazi.
- `src/geo.js`: Dünya, coğrafi koordinat ve Web Mercator döşeme dönüşümleri.
- `src/elevation.js`: Terrarium çözümleme, yükseklik önbelleği ve enterpolasyon.
- `src/terrain.js`: Görüntüleme ve fizik için ortak arazi yüksekliği.
- `src/flight.js`: Birimlendirilmiş uçuş fiziği ve durum yönetimi.
- `src/map.js`: Leaflet dünya haritası, katmanlar, iz ve konum seçimi.
- `server/terrain-tiles.js`: Anahtarsız açık yükseklik verisi için doğrulanan, önbellekli sunucu yolu.
- `server/index.js`: Üretimde uygulamayı ve yükseklik yolunu sunan Node.js sunucusu.
- `src/flight.test.js`: Uçuş, kalkış, iniş, çarpışma, stall ve otopilot testleri.
