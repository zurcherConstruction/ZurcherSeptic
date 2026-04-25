const { BudgetItem } = require('../data');

const defaultItems = [
  // SYSTEM TYPE

  { category: "System Type", name: "TANK ATU 500 GPD", marca: "Fuji", capacity: "500 gpd", description: "FUJI IM1530P/2, 500GPD DBL COMP,  SEPTIC TANK", unitPrice: 1000, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK ATU 700 GPD", marca: "Fuji", capacity: "700 gpd", description: "FUJI IM1530P/2, 700GPD DBL COMP,  SEPTIC TANK", unitPrice: 2000, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK ATU 1000 GPD", marca: "Fuji", capacity: "1000 gpd", description: "FUJI IM1530P/2, 1000GPD DBL COMP,  SEPTIC TANK", unitPrice: 3000, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK ATU 500 GPD", marca: "Infiltrator", capacity: "500 gpd", description: "INFILTRATOR IM1530P/2, 500GPD DBL COMP,  SEPTIC TANK", unitPrice: 5285.17, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK ATU 750 GPD", marca: "Infiltrator", capacity: "750 gpd", description: "INFILTRATOR IM1530P/2, 750GPD DBL COMP,  SEPTIC TANK", unitPrice: 6407.48, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK ATU 1000 GPD", marca: "Infiltrator", capacity: "1000 gpd", description: "INFILTRATOR IM1530P/2, 1000GPD DBL COMP,  SEPTIC TANK", unitPrice: 8119.12, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK REGULAR 1060 GPD", marca: "Infiltrator", capacity: "1060 gpd", description: "INFILTRATOR CM1060P/2 1060GPD 2 COMP SEPTIC TANK", unitPrice: 1197.39, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK REGULAR 1250 GPD", marca: "Infiltrator", capacity: "1250 gpd", description: "INFILTRATOR IM1250/P2 1250GPD DBL COMP SEPTIC TANK ", unitPrice: 1541.19, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK REGULAR 1530 GPD", marca: "Infiltrator", capacity: "1530 gpd", description: "INFILTRATOR IM1530P/2 1530GPD DBL COMP SEPTIC TANK", unitPrice: 1841.88, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK REGULAR 1530 GPD", marca: "Infiltrator", capacity: "540 gpd", description: "INFILTRATOR IM540P/1 540GPD SIN COMP SEPTIC TANK C4", unitPrice: 714.64, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "System Type", name: "TANK REGULAR 1530 GPD", marca: "Infiltrator", capacity: "300 gpd", description: "INFILTRATOR IM300P SING COMP SEPTIC TANK C4 IM300P/1/11-P11", unitPrice: 483.21, supplierName: "FORT MYERS", supplierLocation: "" },

  
  // SISTEMA CHAMBERS
  { category: "Sistema Chambers", imageUrl: "https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755881149/budget_items/iwwpgtpyuanrwd1wtd64.png", name: "END CAP", marca: "", capacity: "", description: "INFILTRATOR Q4+E QUICK4 PLUS FLAT END CAP", unitPrice: 10.78, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "Sistema Chambers", imageUrl: "https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755880904/raaf4rthwtan9sufd123.png", name: "CHAMBERS", marca: "", capacity: "", description: "INFILTRATOR Q4+EQ36LP QUICK4 PLUS EQLZR 36 LOW PROFILE CHAMBER", unitPrice: 29.76, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "Sistema Chambers", imageUrl: "https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755880985/w0z76fqnazt25twcfct4.png", name: "CHAMBERS", marca: "", capacity: "", description: "INFILTRATOR 2412BD3-PP ARC 24 CHAMBER", unitPrice: 40.38, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "Sistema Chambers", imageUrl: "https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755881222/budget_items/caiwzhoiwzndrx3zghrd.png", name: "END CAP", marca: "", capacity: "", description: "INFILTRATOR Q4+A1E QUICK4 PLUS ALL IN ONE END CAP", unitPrice: 16.27, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "Sistema Chambers", imageUrl:"", name: "END CAP", marca: "", capacity: "", description: "INFILTRATOR 2402BD3 ARC 24 STD END CAP", unitPrice: 12.60, supplierName: "FORT MYERS", supplierLocation: "" },

  // PUMP
  { category: "Pump", name: "PUMP TANK LIFT STATION", marca: "", capacity: "300 gal", description: "TANK 300 GAL", unitPrice: 100, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "Pump", name: "PUMP TANK LIFT STATION", marca: "", capacity: "500 gal", description: "TANK 500 GAL", unitPrice: 50, supplierName: "FORT MYERS", supplierLocation: "" },

  // MATERIALES
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 2590, supplierName: "Lehigh acres", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1480, supplierName: "Lehigh acres", supplierLocation: "" },

  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 2800, supplierName: "Cape Coral", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1600, supplierName: "Cape Coral", supplierLocation: "" },

  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 1540, supplierName: "Sebring", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1040, supplierName: "Sebring", supplierLocation: "" },

  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 3010, supplierName: "North Port", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1720, supplierName: "North Port", supplierLocation: "" },

  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 3010, supplierName: "Port Charlotte", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1720, supplierName: "Port Charlotte", supplierLocation: "" },

  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "7 ALL INCLUDED", description: "LOADS SAND INCLUDED", unitPrice: 2660, supplierName: "Deltona", supplierLocation: "" },
  { category: "Sand", name: "SAND TRUCK", marca: "", capacity: "4", description: "4 SAND INCLUDED", unitPrice: 1520, supplierName: "Deltona", supplierLocation: "" },

  { category: "Accesorios", name: "SYSTEM PARTS & ELECTRICAL INSTALLATION (IF THIS INCLUDES)", marca: "", capacity: "", description: "FULL INSTALLATION OF PIPES, ACCESORIES, AND ELECTRICAL WORK FOR THE SEPTIC SYSTEM", unitPrice: 250, supplierName: "", supplierLocation: "" },


  // INSPECTION
  { category: "Inspection", name: "PRIVATE INSPECTION", marca: "", capacity: "", description: "FIRST & FINAL INSPECTION", unitPrice: 500, supplierName: "", supplierLocation: "" },
  { category: "Inspection", name: "PRIVATE INSPECTION", marca: "", capacity: "", description: "FIRST INSPECTION", unitPrice: 200, supplierName: "", supplierLocation: "" },
  { category: "Inspection", name: "PRIVATE INSPECTION", marca: "", capacity: "", description: "NOT INCLUDED", unitPrice: 0, supplierName: "", supplierLocation: "" },


  // LABOR
  { category: "Labor Fee", name: "ZURCHER CONSTRUCTION", marca: "", capacity: "", description: "", unitPrice: 4500, supplierName: "", supplierLocation: "" },
 
  { category: "Rock", name: "ROCK REMOVAL", marca: "", capacity: "", description: "INCLUDED AT NO ADDITIONALCOST IF REQUIRED DURING INSTALLATION", unitPrice: 0, supplierName: "", supplierLocation: "" },
  { category: "Dirt", name: "DIR TRUCK FOR COVER", marca: "", capacity: "", description: "LOADS OF DIRT INCLUDED", unitPrice: 0, supplierName: "", supplierLocation: "" },
   { category: "Dirt", name: "DIR TRUCK FOR COVER", marca: "", capacity: "", description: "LOADS OF DIRT NOT INCLUDED", unitPrice: 0, supplierName: "", supplierLocation: "" },
  

  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093333_opymib.png", name: "13161", marca: "", capacity: "", description: "4X10 3034 SDR35 PVC BOE PLAS PIPE", unitPrice: 17.20, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459911/Captura_de_pantalla_2025-07-02_093416_h8stcy.png", name: "362724", marca: "", capacity: "", description: "INFILTRATOR IM1530P/2 1530GAL DBL COMP SEPTIC TANK", unitPrice: 1841.88, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093427_pko6qz.png", name: "258311", marca: "", capacity: "", description: "INFILTRATOR Q4+EQ36LP QUICK4 PLUS EQLZR 36 LOW PROFILE CHAMBER", unitPrice: 29.76, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459911/Captura_de_pantalla_2025-07-02_093445_d25zh2.png", name: "258314", marca: "", capacity: "", description: "INFILTRATOR Q4+E QUICK4 PLUS FLAT END CAP", unitPrice: 10.78, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459913/Captura_de_pantalla_2025-07-02_093510_hamnh1.png", name: "654662", marca: "", capacity: "", description: "INFILTRATOR IM300P SING COMP SEPTIC TANK C4 IM300P/1/11-P11", unitPrice: 483.21, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755948721/k2wowoottoy24arunfcp.png", name: "484655", marca: "", capacity: "", description: "INFILTRATOR SNAPRIS-B2412 24X12 BLK SNAP RISER W/ 10-PACKSSS-1210HEX SCREWS", unitPrice: 59.86, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"", name: "655711", marca: "", capacity: "", description: "DELTA TREATMENT E50-NXIM15302210LW NSF245 ECOPOD WITH AIR BLOWER AND CONTROL PANEL", unitPrice: 3469.78, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459912/Captura_de_pantalla_2025-07-02_093504_tjuxbd.png", name: "639043", marca: "", capacity: "", description: "INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK", unitPrice: 1197.39, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755880691/kct98bdzhhex4wlyxjzl.png", name: "710880", marca: "", capacity: "", description: "DELTA TREATMENT EDGE5002210LIN NSF245 ECOPOD-EDGE WITH LW250 AERATOR AND CP22010R2 CONTROL PANEL", unitPrice: 4087.78, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"", name: "709352", marca: "", capacity: "", description: "DELTA TREATMENT E75NCM2210 ECOPOD-N SERIES", unitPrice: 4012.70, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"", name: "531396", marca: "", capacity: "", description: "DELTA TREATMENT E100NIM222OECOFGRB ECOPOD-N SERIES F/IM1530 TANK", unitPrice: 5079.85, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755880590/nbnwq5ayajpjbnjujj1y.png", name: "670889", marca: "", capacity: "", description: "INFILTRATOR IM1250/P2 1250GAL DBL COMP SEPTIC TANK", unitPrice: 1541.19, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876659/zxeeqb8ag3oltwnj45lf.png", name: "345096", marca: "", capacity: "", description: "INFILTRATOR IM540P/1 540GAL SIN COMP SEPTIC TANK C4", unitPrice: 714.64, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876620/k4xgyg0j0w871wdejmwc.png", name: "321836", marca: "", capacity: "", description: "INFILTRATOR 2412BD3-PP ARC 24 CHAMBER", unitPrice: 40.38, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"", name: "704694", marca: "", capacity: "", description: "INFILTRATOR 2402BD3 ARC 24 STD END CAP", unitPrice: 12.60, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876581/gfskddpihn4qln7vbt4w.png", name: "258313", marca: "", capacity: "", description: "INFILTRATOR Q4+A1E QUICK4 PLUS ALL IN ONE END CAP", unitPrice: 16.27, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876731/m3nerhpxn1lc5dkfolxy.png", name: "484653", marca: "", capacity: "", description: "INFILTRATOR SNAPRIS-B2406 24X6 BLK SNAP RISER", unitPrice: 36.17, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459913/Captura_de_pantalla_2025-07-02_093519_qjqatt.png", name: "486754", marca: "", capacity: "", description: "INFIWATE IMLID-2400 IM 24IN RISER LID GRN", unitPrice: 57.18, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"", name: "152085", marca: "", capacity: "", description: "TUF-TITE EF4 4 COMBO EFFL FILTER & HOUSING", unitPrice: 28.77, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093318_jmmamp.png", name: "10747", marca: "", capacity: "", description: "HYDRAPRO 4 HXH S&D D3304 1/4 SHORT BEND 90 EQUALS P204 NV3304", unitPrice: 4.29, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755875991/fia5ql2slk6sylwgebio.png", name: "10744", marca: "", capacity: "", description: "HYDRAPRO 4 HXH S&D D3034 CPLG EQUALS P604 NV104", unitPrice: 2.44, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093326_yakcjx.png", name: "10757", marca: "", capacity: "", description: "HYDRAPRO 4 HXHXH S&D D3034 STRAIGHT TEE EQUALS P104 NV804", unitPrice: 4.89, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093355_zbqo0a.png", name: "10764", marca: "", capacity: "", description: "HYDRAPRO 4 HXHXH S&D D3034 2WAY CO TEE EQUALS P1004 NV2204", unitPrice: 13.98, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876344/fgw5tzlnhvko86qwyvut.png", name: "10773", marca: "", capacity: "", description: "HYDRAPRO 4X4 SEWER HUBXDWV HUB D3034 ADPT CPLG EQUALS P657 NV2044", unitPrice: 6.22, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093340_a168sa.png", name: "10772", marca: "", capacity: "", description: "HYDRAPRO 4X3 SEWER HUBXDWV HUB D3034 ADPT CPLG EQUALS P655 NV2043", unitPrice: 4.32, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751459910/Captura_de_pantalla_2025-07-02_093410_ewhp7l.png", name: "10765", marca: "", capacity: "", description: "HYDRAPRO 4 HXHXHXH S&D D3034 CROSS EQUALS P179 NV1304", unitPrice: 19.57, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876140/soyewhgilbi13jujh7b2.png", name: "10752", marca: "", capacity: "", description: "HYDRAPRO 4 HXH S&D D3034 1/8 BEND 45 EQUALS P504 NV504", unitPrice: 3.69, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876076/i5huwd7aervdo74smpkx.png", name: "10748", marca: "", capacity: "", description: "HYDRAPRO 4 HXH S&D D3034 LT 1/4 BEND 90 EQUALS P256 NV304", unitPrice: 5.08, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876251/pwcpreuw5cilbm0f8rpy.png", name: "10767", marca: "", capacity: "", description: "HYDRAPRO 4 HUB S&D D3034 CAP EQUALS P1604 NV1404", unitPrice: 2.14, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876422/fzdsiyqemc4g7kxuj974.png", name: "10776", marca: "", capacity: "", description: "HYDRAPRO 4X11/2 SPGXDWV S&D D3034 RED SLEEVE EQUALS NV1041", unitPrice: 9.14, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876111/fsm3u5ekehuu8drogxbm.png", name: "10751", marca: "", capacity: "", description: "HYDRAPRO 4 HXFPT S&D D3034 FEM ADPT EQUALS P1404 NV2104", unitPrice: 4.89, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876181/lrienp33efw8rcgfbdc9.png", name: "10756", marca: "", capacity: "", description: "HYDRAPRO 4 HXH S&D D3034 1/16 BEND 221/2 EQUALS P1704 NV704", unitPrice: 4.07, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755876529/y0ein5lvzr56hdkd68c9.png", name: "202462", marca: "", capacity: "", description: "CHARLOTTE 03254 106 4 MPT PVC DWV PLUG", unitPrice: 3.15, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894973/obgvtrcq45cmcqegxoca.png", name: "389118", marca: "", capacity: "", description: "LIBERTY 253-3 1/3 HP SUBMERSIBLE EFFLUENT SUMP PUMP 1 PH 115V 35 FT CORD 1-1/2 IN DISCHARGE AUTO", unitPrice: 227.65, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894973/obgvtrcq45cmcqegxoca.png", name: "255029", marca: "", capacity: "", description: "LIBERTY 253-2 1/3 HP SUBMERSIBLE EFFLUENT SUMP PUMP 1 PH 115V 25 FT CORD 1-1/2 IN DISCHARGE AUTO ", unitPrice: 206.47, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894765/cfb1gceyohhleuvnhsxa.png", name: "252367", marca: "", capacity: "", description: "LIBERTY LE51A-2 1/2 HP SEWAGE PUMP 1 PH 115V 25 FT CORD 2 IN DISCHARGE AUTO", unitPrice: 398.24, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894765/cfb1gceyohhleuvnhsxa.png", name: "289285", marca: "", capacity: "", description: "LIBERTY LE41A-2 4/10 HP SEWAGE PUMP 1 PH 115V 25 FT CORD 2 IN DISCHARGE AUTO ", unitPrice: 350.00, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894765/cfb1gceyohhleuvnhsxa.png", name: "50091", marca: "", capacity: "", description: "LIBERTY LE51A 1/2 HP SEWAGE PUMP 1 PH 115V 10 FT CORD 2 IN DISCHARGE AUTO", unitPrice: 376.47, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894685/j40brju46fjtyrginpys.png", name: "178518", marca: "", capacity: "", description: "LIBERTY P382LE51 1/2 HP SIMPLEX SEWAGE PACKAGE 1 PH 115V 2 IN DISCHARGE 10 FT CORD", unitPrice: 542.35, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755895315/hkl5zueerawwrr41jtcw.png", name: "4470", marca: "", capacity: "", description: "4X20 3034 SDR35 PVC BOE PLAS PIPE", unitPrice: 34.40, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894525/zgej3dph7a0hnch2fd57.png", name: "16911", marca: "", capacity: "", description: "11/2X20 SCH40 PVC BOE PLAS PIPE", unitPrice: 12.73, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894525/zgej3dph7a0hnch2fd57.png", name: "4476", marca: "", capacity: "", description: "1X20 SCH40 PVC BOE PLAS PIPE ", unitPrice: 8.11, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755896013/bgkj06n1qxyrfosuwlw4.png", name: "951", marca: "", capacity: "", description: "436010 1 SXMPT SCH40 PVC MALE ADPT", unitPrice: 0.86, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755895950/jhsuwra9nezgpyra6ok4.png", name: "941", marca: "", capacity: "", description: "435010 1 SXFPT SCH40 PVC FEM ADPT", unitPrice: 0.79, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755894189/jgbiqi6hope49czmut2h.png", name: "11783", marca: "", capacity: "", description: "F 1520-15 11/2 SXS PVC SWG CK VLV", unitPrice: 16.80, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893575/e889dspc1hhk2a7rhdnd.png", name: "1025", marca: "", capacity: "", description: "406-007 3/4 SXS SCH40 PVC 90 ELBOW", unitPrice: 0.54, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893424/vte3iehumlenbhrqc8fp.png", name: "1014", marca: "", capacity: "", description: "417-007 3/4 SXS SCH40 PVC 45 ELBOW", unitPrice: 1.60, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893758/ctwdwgfc0hmgblknhrv2.png", name: "1045", marca: "", capacity: "", description: "409-007 3/4 SPGXS SCH40 PVC STREET 90 ELBOW", unitPrice: 2.20, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893181/vgofrrnppxfbtupdb4xa.png", name: "1003", marca: "", capacity: "", description: "429-007 3/4 SXS SCH40 PVC CPLG", unitPrice: 0.43, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893898/lecmsvnencw0d6k9dkbp.png", name: "1051", marca: "", capacity: "", description: "401-007 3/4 SXSXS SCH40 PVC TEE", unitPrice: 0.68, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755895915/ynfmltsctfrndqufg8tg.png", name: "940", marca: "", capacity: "", description: "435-007 3/4 SXF SCH40 PVC FEM ADPT", unitPrice: 0.86, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755895980/nwod07um2vehwy5kvrog.png", name: "950", marca: "", capacity: "", description: "436-007 3/4 MXS SCH40 PVC MALE ADPT", unitPrice: 0.61, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755896047/dbri6eh8xrl8wz6by1k0.png", name: "992", marca: "", capacity: "", description: "447-007 3/4 SCH40 PVC CAP", unitPrice: 0.50, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893667/uglli6l2jcgeysfng32o.png", name: "1027", marca: "", capacity: "", description: "406010 1 SXS SCH40 PVC 90 ELBOW", unitPrice: 0.96, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893496/quxv8tgokfssucs9hbhs.png", name: "1015", marca: "", capacity: "", description: "417010 1 SXS SCH40 PVC 45 ELBOW", unitPrice: 1.47, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893837/u1adwl1v4zicuqqishds.png", name: "1046", marca: "", capacity: "", description: "409010 1 SPGXS SCH40 PVC STREET 90 ELBOW", unitPrice: 2.86, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755893302/xlaw9h2y18sfdfjgiitb.png", name: "1004", marca: "", capacity: "", description: "429010 1 SXS SCH40 PVC CPLG", unitPrice: 0.76, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755896077/astjrnkulwicwd57pese.png", name: "993", marca: "", capacity: "", description: "447010 1 SCH40 PVC CAP", unitPrice: 0.79, supplierName: "FORT MYERS", supplierLocation: "" },

  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907478/ybgivqf2htv3tsmk5iiq.png", name: "500GPD 1530 ECOPOD", marca: "", capacity: "", description: "362724-INFILTRATOR IM1530P/2 1530GAL DBL COMP SEPTIC TANK, 655711-DELTA TREATMENT E50-NXIM15302210LW NSF245 ECOPOD WITH AIR BLOWER AND CONTROL PANEL", unitPrice: 5311.66, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907449/y0g8ub9xhhxlbzkzmtet.png", name: "500GPD 1060 ECOPOD", marca: "", capacity: "", description: "639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK , 710880-DELTA TREATMENT EDGE5002210LIN NSF245 ECOPOD-EDGE WITH LW250 AERATOR AND CP22010R2 CONTROL PANEL", unitPrice: 5285.17, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907536/qz9q4qu4wedi6ojaxbzx.png", name: "750GPD ECOPOD", marca: "", capacity: "", description: "639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK , 709352-DELTA TREATMENT E75NCM2210 ECOPOD-N SERIES", unitPrice: 6407.48, supplierName: "FORT MYERS", supplierLocation: "" },
  { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907413/p2vjwxeandp8cofhecsw.png", name: "1000GPD ECOPOD", marca: "", capacity: "", description: "362724-INFILTRATOR IM1530P/2 1530GAL DBL COMP SEPTIC TANK, 639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK, 531396-DELTA TREATMENT E100NIM222OECOFGRB ECOPOD-N SERIES F/IM1530 TANK", unitPrice: 8119.12, supplierName: "FORT MYERS", supplierLocation: "" },


  //
  // { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907478/ybgivqf2htv3tsmk5iiq.png", name: "500GPD 1530 ECOPOD", marca: "", capacity: "", description: "362724-INFILTRATOR IM1530P/2 1530GAL DBL COMP SEPTIC TANK, 655711-DELTA TREATMENT E50-NXIM15302210LW NSF245 ECOPOD WITH AIR BLOWER AND CONTROL PANEL", unitPrice: 0, supplierName: "PORT CHARLOTTE", supplierLocation: "" },
  // { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907449/y0g8ub9xhhxlbzkzmtet.png", name: "500GPD 1060 ECOPOD", marca: "", capacity: "", description: "639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK , 710880-DELTA TREATMENT EDGE5002210LIN NSF245 ECOPOD-EDGE WITH LW250 AERATOR AND CP22010R2 CONTROL PANEL", unitPrice: 5285.17, supplierName: "PORT CHARLOTTE", supplierLocation: "" },
  // { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907536/qz9q4qu4wedi6ojaxbzx.png", name: "750GPD ECOPOD", marca: "", capacity: "", description: "639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK , 709352-DELTA TREATMENT E75NCM2210 ECOPOD-N SERIES", unitPrice: 6407.48, supplierName: "PORT CHARLOTTE", supplierLocation: "" },
  // { category: "MATERIALES", imageUrl:"https://res.cloudinary.com/dt4ah1jmy/image/upload/v1755907413/p2vjwxeandp8cofhecsw.png", name: "1000GPD ECOPOD", marca: "", capacity: "", description: "362724-INFILTRATOR IM1530P/2 1530GAL DBL COMP SEPTIC TANK, 639043-INFILTRATOR CM1060P/2 1060G 2 COMP SEPTIC TANK, 531396-DELTA TREATMENT E100NIM222OECOFGRB ECOPOD-N SERIES F/IM1530 TANK", unitPrice: 8119.12, supplierName: "PORT CHARLOTTE", supplierLocation: "" },
];


const seedBudgetItems = async (verbose = true) => {
  try {
    if (verbose) console.log('🌱 Verificando BudgetItems...');
    
    // Verificar si ya existen items (para evitar duplicados)
    const existingItems = await BudgetItem.count();
    
    if (existingItems > 0) {
      if (verbose) {
        console.log(`⚠️  Ya existen ${existingItems} items en la base de datos.`);
        console.log('💡 Si deseas recargar los items por defecto, ejecuta: npm run seed:reset');
      }
      return { message: 'Items ya existen', count: existingItems };
    }

    // Crear todos los items por defecto
    const createdItems = await BudgetItem.bulkCreate(defaultItems);
    console.log(`✅ Se crearon ${createdItems.length} items por defecto.`);
    
    return { message: 'Items creados', count: createdItems.length };
  } catch (error) {
    console.error('❌ Error al verificar/crear BudgetItems:', error);
    throw error;
  }
};

const resetAndSeedBudgetItems = async () => {
  try {
    console.log('🔄 Reseteando y recargando BudgetItems...');
    
    // Eliminar todos los items existentes
    await BudgetItem.destroy({ where: {}, force: true });
    console.log('🗑️  Items existentes eliminados.');
    
    // Crear los items por defecto
    const createdItems = await BudgetItem.bulkCreate(defaultItems);
    console.log(`✅ Se recrearon ${createdItems.length} items por defecto.`);
    
    return { message: 'Items reseteados y creados', count: createdItems.length };
  } catch (error) {
    console.error('❌ Error al resetear BudgetItems:', error);
    throw error;
  }
};

module.exports = {
  seedBudgetItems,
  resetAndSeedBudgetItems,
  defaultItems
};