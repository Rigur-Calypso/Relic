// Shared geography helpers — precise lat/lng coordinates for each monitored facility.
// Every lab is mapped to its actual campus location for accurate globe placement.

const TLD = [
  [/\.ac\.uk$|\.uk$/, 'UK'], [/\.ac\.in$|\.res\.in$|\.iisc|\.iitb|\.ac\.in/, 'India'],
  [/\.edu\.au$|\.au$/, 'Australia'], [/\.ca$/, 'Canada'], [/\.ch$/, 'Switzerland'],
  [/\.de$/, 'Germany'], [/\.fr$/, 'France'], [/\.nl$/, 'Netherlands'], [/\.se$/, 'Sweden'],
  [/\.fi$/, 'Finland'], [/\.dk$/, 'Denmark'], [/\.be$/, 'Belgium'], [/\.il$/, 'Israel'],
  [/\.ac\.kr$|\.kr$/, 'South Korea'], [/\.ac\.jp$|\.jp$/, 'Japan'], [/\.edu\.sg$|\.sg$/, 'Singapore'],
  [/\.hk$/, 'Hong Kong'], [/\.tw$/, 'Taiwan'], [/\.tr$|bilkent/, 'Turkey'], [/\.br$|unicamp/, 'Brazil'],
  [/\.gov$/, 'USA'], [/\.edu$/, 'USA'],
];

export function countryOf(url) {
  let host = '';
  try { host = new URL(url).host; } catch { return null; }
  if (/github\.io|localhost|YOUR_GH/.test(host)) return null;
  for (const [re, name] of TLD) if (re.test(host)) return name;
  return host.split('.').slice(-1)[0]?.toUpperCase() || null;
}

// Precise coordinates for each lab by its target ID.
// [latitude, longitude] — sourced from actual campus locations.
const COORDS = {
  // ── India ──
  'saif-iitb':      [19.1334,  72.9133],   // IIT Bombay, Mumbai
  'crf-iitd':       [28.5450,  77.1926],   // IIT Delhi, New Delhi
  'cense-iisc':     [13.0219,  77.5671],   // IISc Bangalore
  'npl-csir':       [28.6328,  77.1726],   // NPL, New Delhi
  'iiser-pune':     [18.5490,  73.8081],   // IISER Pune
  'bits-pilani':    [15.3910,  73.8780],   // BITS Goa
  'iitkgp-crf':     [22.3149,  87.3105],   // IIT Kharagpur
  'tifr-cf':        [19.0760,  72.8777],   // TIFR, Mumbai
  'jncasr':         [13.0727,  77.5800],   // JNCASR, Bangalore
  'uohyd-cif':      [17.4604,  78.3264],   // University of Hyderabad
  'anna-caf':       [13.0108,  80.2354],   // Anna University, Chennai
  'iith-crf':       [17.5942,  78.1199],   // IIT Hyderabad
  'iitgn-cif':      [23.2116,  72.6843],   // IIT Gandhinagar
  'iitmandi-c4dfed':[31.7754,  76.9861],   // IIT Mandi
  'iitp-cif':       [25.5356,  84.8512],   // IIT Patna
  'iiserb-cif':     [23.2884,  77.2706],   // IISER Bhopal
  'iisertvm-cif':   [8.5556,   76.8982],   // IISER Thiruvananthapuram
  'du-usic':        [28.6856,  77.2100],   // University of Delhi
  'pu-chd-cil':     [30.7600,  76.7680],   // Panjab University, Chandigarh
  'saha-scf':       [22.5558,  88.3794],   // Saha Institute, Kolkata
  'annamalai-cif':  [11.4000,  79.7300],   // Annamalai University
  'jadavpur-cif':   [22.4996,  88.3714],   // Jadavpur University, Kolkata
  'vit-cif':        [12.9692,  79.1559],   // VIT, Vellore
  'srm-cif':        [12.8237,  80.0440],   // SRM, Chennai
  'manipal-cif':    [13.3525,  74.7928],   // Manipal
  'nit-trichy':     [10.7597,  78.8153],   // NIT Trichy
  'nit-rourkela':   [22.2525,  84.9026],   // NIT Rourkela
  'sppu-pune':      [18.5565,  73.8250],   // Savitribai Phule Pune University
  'gauhati-usic':   [26.1540,  91.6615],   // Gauhati University
  'amrita-cif':     [10.9006,  76.9020],   // Amrita, Coimbatore
  'ssn-cif':        [12.7515,  80.1996],   // SSN, Chennai
  'thapar-cif':     [30.3530,  76.3650],   // Thapar, Patiala

  // ── USA ──
  'mit-mrsec':      [42.3601, -71.0942],   // MIT, Cambridge MA
  'snsf-stanford':  [37.4275, -122.1697],  // Stanford University
  'cornell-cnf':    [42.4534, -76.4735],   // Cornell, Ithaca NY
  'duke-smif':      [36.0014, -78.9382],   // Duke, Durham NC
  'purdue-birck':   [40.4237, -86.9212],   // Purdue, West Lafayette
  'pennstate-mri':  [40.7982, -77.8599],   // Penn State
  'ucsb-nano':      [34.4140, -119.8489],  // UC Santa Barbara
  'notredame-ndnf': [41.7002, -86.2379],   // Notre Dame
  'umich-lnf':      [42.2808, -83.7430],   // U Michigan, Ann Arbor
  'harvard-cns':    [42.3770, -71.1167],   // Harvard, Cambridge MA
  'columbia-cni':   [40.8075, -73.9626],   // Columbia, NYC
  'princeton-prism':[40.3573, -74.6672],   // Princeton
  'yale-snf':       [41.3163, -72.9223],   // Yale, New Haven
  'ucla-cnsi':      [34.0689, -118.4452],  // UCLA
  'ucsd-nano3':     [32.8801, -117.2340],  // UC San Diego
  'uci-inrf':       [33.6405, -117.8443],  // UC Irvine
  'utexas-mrc':     [30.2849, -97.7341],   // UT Austin
  'rice-shared':    [29.7174, -95.4018],   // Rice, Houston
  'vt-ncfl':        [37.2296, -80.4139],   // Virginia Tech
  'ncsu-aif':       [35.7847, -78.6821],   // NC State, Raleigh
  'unc-chanl':      [35.9049, -79.0469],   // UNC Chapel Hill
  'vanderbilt-vinse':[36.1447, -86.8027],  // Vanderbilt, Nashville
  'wisc-wcnt':      [43.0731, -89.4012],   // UW Madison
  'uiuc-mrl':       [40.1106, -88.2073],   // UIUC
  'northwestern-nuance': [42.0565, -87.6753], // Northwestern, Evanston
  'lehigh-emf':     [40.6060, -75.3783],   // Lehigh, Bethlehem PA
  'rpi-cbis':       [42.7284, -73.6918],   // RPI, Troy NY
  'bu-photonics':   [42.3505, -71.1054],   // Boston University
  'arizona-kuiper': [32.2319, -110.9501],  // U Arizona, Tucson
  'unm-cint':       [35.0844, -106.6504],  // UNM, Albuquerque
  'utah-nanofab':   [40.7649, -111.8421],  // U Utah, Salt Lake City
  'oregonstate-nano':[44.5646, -123.2620], // Oregon State, Corvallis
  'uoregon-camcor': [44.0448, -123.0726],  // U Oregon, Eugene
  'washington-moles':[47.6553, -122.3035],  // UW Seattle
  'wustl-imse':     [38.6488, -90.3108],   // WashU, St Louis
  'uh-nanofab':     [29.7199, -95.3422],   // U Houston
  'texasam-mcf':    [30.6187, -96.3365],   // Texas A&M, College Station
  'msu-ceo':        [42.7010, -84.4818],   // Michigan State
  'lbnl-foundry':   [37.8755, -122.2477],  // LBNL, Berkeley
  'bnl-cfn':        [40.8683, -72.8786],   // Brookhaven, Long Island
  'ucdavis-cnm':    [38.5382, -121.7617],  // UC Davis
  'ucr-cfamm':      [33.9737, -117.3281],  // UC Riverside
  'northeastern-nano':[42.3398, -71.0892], // Northeastern, Boston
  'colorstate-arc': [40.5734, -105.0866],  // Colorado State
  'texastech-nano': [33.5843, -101.8460],  // Texas Tech, Lubbock
  'iowastate-mario':[42.0308, -93.6319],   // Iowa State, Ames

  // ── UK ──
  'cambridge-nano': [52.2053,   0.1218],   // Cambridge
  'oxford-dmc':     [51.7520,  -1.2577],   // Oxford
  'warwick-rtp':    [52.3838,  -1.5616],   // Warwick
  'standrews-nano': [56.3398,  -2.7967],   // St Andrews
  'cardiff-crf':    [51.4816,  -3.1791],   // Cardiff

  // ── Europe ──
  'leuven-imec':    [50.8629,   4.6753],   // KU Leuven / imec
  'kth-electrum':   [59.4047,  17.9497],   // KTH, Stockholm
  'aalto-micronova':[60.1841,  24.8261],   // Aalto, Espoo Finland
  'kit-nano':       [49.0069,   8.4037],   // KIT, Karlsruhe
  'tumunich-znn':   [48.2629,  11.6687],   // TU Munich
  'ethz-brnc':      [47.3769,   8.5417],   // ETH Zurich
  'stuttgart-mpg':  [48.7401,   9.0976],   // Max Planck Stuttgart
  'ghent-nano':     [51.0543,   3.7174],   // Ghent University
  'lund-nano':      [55.7047,  13.1910],   // Lund University
  'aachen-rwth':    [50.7753,   6.0839],   // RWTH Aachen
  'munich-lmu':     [48.1497,  11.5785],   // LMU Munich
  'basel-nano':     [47.5596,   7.5886],   // University of Basel
  'trinity-crann':  [53.3438,  -6.2546],   // Trinity College Dublin

  // ── Israel ──
  'weizmann-nano':  [31.9060,  34.8088],   // Weizmann, Rehovot
  'technion-mnfu':  [32.7775,  35.0217],   // Technion, Haifa

  // ── Asia (outside India) ──
  'ntu-nanofab':    [1.3483,  103.6831],   // NTU Singapore
  'kaist-nanofab':  [36.3715, 127.3625],   // KAIST, Daejeon
  'unist-ucrf':     [35.5730, 129.1900],   // UNIST, Ulsan
  'yonsei-nano':    [37.5644, 126.9387],   // Yonsei, Seoul
  'nthu-taiwan':    [24.7961, 120.9967],   // NTHU, Hsinchu
  'osaka-nano':     [34.7684, 135.5250],   // Osaka University
  'tsukuba-nims':   [36.0662, 140.1335],   // U Tsukuba / NIMS
  'bilkent-unam':   [39.8676,  32.7488],   // Bilkent, Ankara

  // ── Australia ──
  'melbourne-mcn':  [-37.7816, 144.9617],  // Melbourne
  'monash-mcem':    [-37.9125, 145.1362],  // Monash

  // ── Canada ──
  'toronto-tnfc':   [43.6591, -79.3957],   // U of Toronto
  'mcgill-nano':    [45.5048, -73.5772],   // McGill, Montreal
  'alberta-nanofab':[53.5232,-113.5263],   // U Alberta, Edmonton
  'queens-nano':    [44.2253, -76.4951],   // Queen's, Kingston
  'western-nano':   [43.0096, -81.2737],   // Western, London ON
  'polymtl-nano':   [45.5050, -73.6130],   // Polytechnique Montreal

  // ── South America ──
  'unicamp-brazil': [-22.8184, -47.0647],  // Unicamp, Campinas

  // ── New batch (discovered) ──
  'gt-ien':           [33.7780, -84.3963],   // Georgia Tech, Atlanta
  'caltech-kni':      [34.1377, -118.1253],  // Caltech, Pasadena
  'minnesota-mnc':    [44.9746, -93.2313],   // U Minnesota, Minneapolis
  'upenn-singh':      [39.9522, -75.1910],   // UPenn Singh Center, Philadelphia
  'maryland-fablab':  [38.9897, -76.9378],   // U Maryland, College Park
  'asu-nanofab':      [33.4234, -111.9391],  // Arizona State, Tempe
  'ufl-nrf':          [29.6436, -82.3549],   // U Florida, Gainesville
  'pitt-nfcf':        [40.4444, -79.9608],   // U Pittsburgh
  'argonne-cnm':      [41.7183, -87.9814],   // Argonne National Lab, IL
  'ornl-cnms':        [35.9301, -84.3120],   // Oak Ridge National Lab, TN
  'nist-cnst':        [39.1349, -77.2199],   // NIST, Gaithersburg MD
  'epfl-cmi':         [46.5191, 6.5668],     // EPFL, Lausanne
  'delft-kavli':      [51.9989, 4.3733],     // TU Delft
  'chalmers-mc2':     [57.6889, 11.9787],    // Chalmers, Gothenburg
  'dtu-nanolab':      [55.7861, 12.5234],    // DTU, Lyngby
  'glasgow-jwnc':     [55.8721, -4.2882],    // U Glasgow, JWNC
  'southampton-nano': [50.9377, -1.3959],    // U Southampton
  'twente-mesa':      [52.2395, 6.8567],     // U Twente, Enschede
  'tyndall-ireland':  [51.8896, -8.4894],    // Tyndall, Cork
  'nus-nanofab':      [1.2966, 103.7764],    // NUS, Singapore
  'postech-nano':     [36.0140, 129.3220],   // POSTECH, Pohang
  'iitk-4i':          [26.5123, 80.2329],    // IIT Kanpur
  'iitr-iic':         [29.8650, 77.8964],    // IIT Roorkee
  'iitm-crf':         [12.9915, 80.2337],    // IIT Madras, Chennai
  'louisville-mntc':  [38.2160, -85.7580],   // U Louisville, KY
  'sutd-cleanroom':   [1.3410, 103.9640],    // SUTD, Singapore
  'iitbhilai-cif':    [21.1938, 81.2860],    // IIT Bhilai
  'bristol-nsqi':     [51.4584, -2.6030],    // U Bristol, UK
  'sheffield-nano':   [53.3811, -1.4799],    // U Sheffield, UK
  'cmu-nanofab':      [40.4433, -79.9436],   // Carnegie Mellon, Pittsburgh
  'utd-cleanroom':    [32.9857, -96.7501],   // UT Dallas, Richardson TX
  'unl-ncmn':         [40.8202, -96.7005],   // U Nebraska–Lincoln
  'rutgers-nano':     [40.5218, -74.4610],   // Rutgers, Piscataway NJ
  'kaust-corelabs':   [22.3095, 39.1044],    // KAUST, Thuwal, Saudi Arabia
  'birmingham-nano':  [52.4508, -1.9305],    // U Birmingham, UK
  'leeds-nano':       [53.8067, -1.5550],    // U Leeds, UK
  'ncku-taiwan':      [22.9997, 120.2170],   // NCKU, Tainan, Taiwan

  // ── Decoy ──
  'decoy':          [40.0, -74.0],         // Placeholder
};

// deterministic tiny jitter from a string — just enough to separate co-located labs
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

export function latLngOf(lab) {
  // First check the precise coordinates lookup
  const precise = COORDS[lab.id];
  if (precise) return precise;

  // Fallback: use country centroid with tiny jitter (±2 degrees)
  const c = countryOf(lab.url);
  const CENTROID = {
    USA: [39.8, -98.6], India: [22.6, 79], UK: [54, -2.4], Canada: [56, -106],
    Switzerland: [46.8, 8.2], Germany: [51.2, 10.4], France: [46.6, 2.2], Netherlands: [52.1, 5.3],
    Sweden: [60.1, 18.6], Finland: [64, 26], Denmark: [56, 10], Belgium: [50.5, 4.5], Israel: [31, 35],
    'South Korea': [36.5, 127.8], Japan: [36.2, 138.3], Singapore: [1.35, 103.8], 'Hong Kong': [22.3, 114.2],
    Taiwan: [23.7, 121], Australia: [-25, 133], Turkey: [39, 35], Brazil: [-14, -51.9],
  };
  const base = CENTROID[c];
  const jx = (hash(lab.id) - 0.5) * 4, jy = (hash(lab.id + 'y') - 0.5) * 4;
  if (base) return [base[0] + jx, base[1] + jy];
  // truly unknown → spread deterministically
  return [(hash(lab.id) - 0.5) * 140, (hash(lab.id + 'lng') - 0.5) * 300];
}

// lat/lng (deg) → unit-sphere xyz
export function latLngToXYZ(lat, lng) {
  const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
  return [-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
}
