// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}
// ==================== 1. الحماية وإعدادات الجلسة ====================
let userEmpId = sessionStorage.getItem("userEmpId");
let inspectorCenter = sessionStorage.getItem("inspectorCenter");

// تم حذف سطر الطرد المباشر لأنه يعمل قبل التحقق من فايربيز

function goBack() {
    if (userEmpId === "ADMIN_ACCESS") window.location.href = "/admin-panel";
    else window.location.href = "/inspector";
}

// ==================== فحص صلاحيات المسؤول الإداري ====================
async function checkUserPermissions() {
    if (userEmpId !== "ADMIN_ACCESS") {
        try {
            const adminDoc = await db.collection("center_admins").doc(String(userEmpId)).get();
            if (adminDoc.exists) {
                const data = adminDoc.data();
                if (data.jobTitle === "المسؤول الإداري") {
                    document.body.innerHTML = ""; 
                    Swal.fire({
                        icon: 'error',
                        title: 'صلاحيات مقيدة',
                        text: 'عذراً أستاذي الكريم، إدارة المراكز وملفات المقاييس هي صلاحية حصرية للمسؤول البيداغوجي.',
                        allowOutsideClick: false,
                        confirmButtonText: 'العودة للوحة التحكم',
                        confirmButtonColor: '#102a43'
                    }).then(() => {
                        window.location.href = "/inspector";
                    });
                    return false;
                }
            }
        } catch(e) {
            console.warn("خطأ في التحقق من الصلاحيات:", e);
        }
    }
    return true;
}

// ==================== 2. إعدادات Firebase والبيانات المركزية ====================
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

let SITE_SETTINGS = null;

// أيقونات وتصنيفات شاملة للأطوار والتخصصات (ديناميكية مع قيم افتراضية موسعة)
const KNOWN_SPECS = {
    'arabic': { name: 'اللغة العربية', icon: 'fa-book-open', keywords: ['عرب', 'أدب'] },
    'french': { name: 'اللغة الفرنسية', icon: 'fa-language', keywords: ['فرنس'] },
    'english': { name: 'اللغة الإنجليزية', icon: 'fa-font', keywords: ['إنجليز', 'انجليز'] },
    'sport': { name: 'التربية البدنية والرياضية', icon: 'fa-person-running', keywords: ['بدن', 'رياضة'] },
    'math': { name: 'الرياضيات', icon: 'fa-calculator', keywords: ['رياضيات', 'حساب'] },
    'physics': { name: 'العلوم الفيزيائية والتكنولوجيا', icon: 'fa-atom', keywords: ['فيزياء', 'فيزيائ'] },
    'science': { name: 'علوم الطبيعة والحياة', icon: 'fa-dna', keywords: ['طبيعة', 'علوم'] },
    'history_geo': { name: 'التاريخ والجغرافيا', icon: 'fa-earth-africa', keywords: ['تاريخ', 'جغرافيا'] },
    'islamic': { name: 'العلوم الإسلامية', icon: 'fa-mosque', keywords: ['إسلام', 'اسلام', 'شريعة'] },
    'philosophy': { name: 'الفلسفة', icon: 'fa-brain', keywords: ['فلسف'] },
    'art': { name: 'التربية التشكيلية والرسم', icon: 'fa-palette', keywords: ['رسم', 'تشكيل'] },
    'music': { name: 'التربية الموسيقية', icon: 'fa-music', keywords: ['موسيق'] },
    'civil_eng': { name: 'الهندسة المدنية', icon: 'fa-trowel-bricks', keywords: ['مدني'] },
    'electrical_eng': { name: 'الهندسة الكهربائية', icon: 'fa-bolt', keywords: ['كهربا'] },
    'mechanical_eng': { name: 'الهندسة الميكانيكية', icon: 'fa-gear', keywords: ['ميكانيك'] },
    'process_eng': { name: 'هندسة الطرائق', icon: 'fa-flask-vial', keywords: ['طرائق'] },
    'informatics': { name: 'الإعلام الآلي', icon: 'fa-laptop-code', keywords: ['إعلام آلي', 'اعلام آلي', 'حاسوب'] },
    'amazigh': { name: 'اللغة الأمازيغية', icon: 'fa-shapes', keywords: ['أمازيغ', 'امازيغ'] },
    'economy': { name: 'تسيير واقتصاد', icon: 'fa-chart-line', keywords: ['تسيير', 'اقتصاد', 'محاسبة'] },
    'others': { name: 'باقي التخصصات', icon: 'fa-layer-group', keywords: [] }
};

const KNOWN_LEVELS = {
    'primary': { name: 'الطور الابتدائي', icon: 'fa-child-reaching', keywords: ['ابتدائي', 'ابتدائية'] },
    'middle': { name: 'الطور المتوسط', icon: 'fa-school', keywords: ['متوسط', 'متوسطة'] },
    'secondary': { name: 'الطور الثانوي', icon: 'fa-user-graduate', keywords: ['ثانوي', 'ثانوية'] }
};

const DEFAULT_ICONS = {
    levels: {
        'primary': { name: 'الطور الابتدائي', icon: 'fa-child-reaching' },
        'middle': { name: 'الطور المتوسط', icon: 'fa-school' },
        'secondary': { name: 'الطور الثانوي', icon: 'fa-user-graduate' }
    },
    specs: {}
};
for (let k in KNOWN_SPECS) {
    DEFAULT_ICONS.specs[k] = { name: KNOWN_SPECS[k].name, icon: KNOWN_SPECS[k].icon };
}

// دالة تحليل وتحديد التخصص ديناميكياً من نصوص قاعدة البيانات
function resolveSpecialization(rawMaty) {
    if (!rawMaty) return { key: 'others', name: 'باقي التخصصات', icon: 'fa-layer-group' };
    const clean = rawMaty.trim().toLowerCase();
    
    // 1. التحقق من المفاتيح المباشرة
    if (KNOWN_SPECS[clean]) {
        return { key: clean, ...KNOWN_SPECS[clean] };
    }
    
    // 2. التحقق من إعدادات الموقع المركزية
    if (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.specs) {
        for (let k in SITE_SETTINGS.UI_NAMES.specs) {
            if (k === clean || SITE_SETTINGS.UI_NAMES.specs[k].trim() === rawMaty.trim()) {
                const icon = (SITE_SETTINGS.UI_NAMES.specIcons && SITE_SETTINGS.UI_NAMES.specIcons[k]) 
                             || (KNOWN_SPECS[k] ? KNOWN_SPECS[k].icon : 'fa-book');
                return { key: k, name: SITE_SETTINGS.UI_NAMES.specs[k], icon: icon };
            }
        }
    }
    
    // 3. التحقق الذكي بالكلمات المفتاحية (الانتباه: الرياضيات تختلف كلياً عن الرياضة البدنية)
    if (clean.includes('رياضيات') || clean.includes('حساب')) {
        return { key: 'math', ...KNOWN_SPECS['math'] };
    }
    if (clean.includes('بدن') || clean.includes('رياضة') || clean.includes('بدنية')) {
        return { key: 'sport', ...KNOWN_SPECS['sport'] };
    }
    
    for (let k in KNOWN_SPECS) {
        if (k === 'sport' || k === 'others') continue;
        if (KNOWN_SPECS[k].keywords && KNOWN_SPECS[k].keywords.some(kw => clean.includes(kw))) {
            return { key: k, ...KNOWN_SPECS[k] };
        }
    }
    
    // 4. تخصص جديد تماماً لم يسبق برمجته: إنشاء مفتاح آمن له
    let safeKey = clean.replace(/[^a-zA-Z0-9_\u0621-\u064A]/g, '_');
    return { key: safeKey, name: rawMaty.trim(), icon: 'fa-book' };
}

// دالة تحليل وتحديد الرتبة / الطور ديناميكياً
function resolveLevel(rawGrade) {
    if (!rawGrade) return { key: 'primary', name: 'الطور الابتدائي', icon: 'fa-child-reaching' };
    const clean = rawGrade.trim().toLowerCase();
    
    for (let k in KNOWN_LEVELS) {
        if (KNOWN_LEVELS[k].keywords.some(kw => clean.includes(kw))) {
            return { key: k, ...KNOWN_LEVELS[k] };
        }
    }
    
    let safeKey = clean.replace(/[^a-zA-Z0-9_\u0621-\u064A]/g, '_');
    return { key: safeKey, name: rawGrade.trim(), icon: 'fa-graduation-cap' };
}

// دوال مساعدة للقراءة الديناميكية من SITE_SETTINGS
function getIconsLevels() {
    let result = {};
    const levels = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels) || {};
    const levelIcons = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levelIcons) || {};
    for (let key in DEFAULT_ICONS.levels) {
        result[key] = { name: levels[key] || DEFAULT_ICONS.levels[key].name, icon: (levelIcons[key] && levelIcons[key].icon) || DEFAULT_ICONS.levels[key].icon };
    }
    for (let key in levels) {
        if (!result[key]) {
            result[key] = { name: levels[key], icon: (levelIcons[key] && levelIcons[key].icon) || 'fa-layer-group' };
        }
    }
    return result;
}

function getIconsSpecs() {
    let result = {};
    const specs = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.specs) || {};
    const specIcons = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.specIcons) || {};
    for (let key in DEFAULT_ICONS.specs) {
        result[key] = { name: specs[key] || DEFAULT_ICONS.specs[key].name, icon: (specIcons[key] && specIcons[key].icon) || DEFAULT_ICONS.specs[key].icon };
    }
    for (let key in specs) {
        if (!result[key]) {
            // فحص إذا كان اسماً معروفاً
            const res = resolveSpecialization(specs[key]);
            result[key] = { name: specs[key], icon: (specIcons[key] && specIcons[key].icon) || res.icon || 'fa-book' };
        }
    }
    return result;
}

// جلب الإعدادات وبناء الأزرار
function initSiteSettings() {
    const docRef = db.collection("site_settings").doc("main");
    
    docRef.onSnapshot(async (doc) => { 
        if (doc.exists) {
            SITE_SETTINGS = doc.data();
            
            if (userEmpId !== "ADMIN_ACCESS") {
                try {
                    const adminDoc = await db.collection("center_admins").doc(String(userEmpId)).get();
                    if (adminDoc.exists && adminDoc.data().jobTitle === "المسؤول الإداري") {
                        document.body.innerHTML = ""; 
                        Swal.fire({
                            icon: 'error',
                            title: 'صلاحيات مقيدة',
                            text: 'عذراً أستاذي الكريم، إدارة ملفات المقاييس هي صلاحية حصرية للمسؤول البيداغوجي.',
                            confirmButtonColor: '#1E68E8',
                            allowOutsideClick: false
                        }).then(() => {
                            window.location.href = "/inspector"; 
                        });
                        return; 
                    }
                } catch (e) {
                    console.error("خطأ في فحص الصلاحيات:", e);
                }
            }

            renderCenters(); 
        } else {
            Swal.fire('خطأ', 'لم يتم العثور على إعدادات الموقع المركزية.', 'error');
        }
    });
}

// ==================== 3. الرسم الديناميكي للواجهة ====================

function renderCenters() {
    const container = document.getElementById("centers-container");
    container.innerHTML = "";
    
    const centers = SITE_SETTINGS.UI_NAMES.centers || {};
    let hasCenters = false;

    for (let cId in centers) {
        hasCenters = true;
        const cName = centers[cId];
        container.innerHTML += `
            <div class="service" onclick="openCenter('${cId}')">
                <div class="service-icon-wrapper"><i class="fa-solid fa-school"></i></div>
                <h3>مركز التكوين<br>${cName}</h3>
            </div>
        `;
    }

    if (!hasCenters) {
        container.innerHTML = '<div style="grid-column: 1/-1; color: #dc2626; font-weight: bold; font-size: 18px;">لا توجد مراكز تكوين مبرمجة حالياً.</div>';
    }
}

async function openCenter(centerId) {
  const selectedCenterName = SITE_SETTINGS.UI_NAMES.centers[centerId];
  
  if (userEmpId !== "ADMIN_ACCESS" && selectedCenterName !== inspectorCenter) {
     Swal.fire({
          icon: 'warning',
          title: '<h3 style="color:#d32f2f; margin:0; font-weight:700; font-family:\'Cairo\';"><i class="fa-solid fa-shield-halved"></i> صلاحيات مقيدة</h3>',
          html: `
              <div style="font-size: 15px; line-height: 1.8; color: #444; padding: 5px 0; font-family:\'Cairo\';">
                  عذراً أستاذي الكريم، النظام يمنع وصولك إلى ملفات هذا المركز لعدم امتلاكك الصلاحيات الإدارية اللازمة.
                  
                  <div style="color: #d32f2f; font-size: 16px; font-weight: bold; margin: 15px 0; padding: 10px; background: #ffebee; border-radius: 8px; border: 1px dashed #d32f2f;">
                      <i class="fa-solid fa-ban"></i> ${selectedCenterName}
                  </div>
                  
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 15px 0;">
                  
                  <div style="font-size: 14px; color: #666; margin-bottom: 10px;">
                      تقتصر صلاحياتك الحالية بصفتك مشرفاً على إدارة ملفات مركزك فقط:
                  </div>
                  
                  <div>
                      <span style="background: #e8fbf0; color: #0FBA50; padding: 8px 15px; border-radius: 8px; font-weight: bold; border: 1px solid #0FBA50; display: inline-block;">
                          <i class="fa-solid fa-check-circle"></i> ${inspectorCenter}
                      </span>
                  </div>
              </div>
          `,
          confirmButtonText: '<i class="fa-solid fa-check"></i> حسناً، فهمت',
          confirmButtonColor: '#102a43'
      });
      return;
  }

  // إشعار تحميل سريع أثناء فحص رتب وتخصصات المركز من قاعدة البيانات
  Swal.fire({
      title: 'جاري فحص المركز...',
      html: '<div style="font-size:14px; color:#64748b; margin-top:8px;">مزامنة الرتب والتخصصات من قاعدة بيانات المتكونين...</div>',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => { Swal.showLoading(); }
  });

  // مزامنة ديناميكية للأطوار والتخصصات الخاصة بالمركز من مجموعة employeescomnew
  let newSyncNeeded = false;
  if (!SITE_SETTINGS.dbLinks[centerId]) SITE_SETTINGS.dbLinks[centerId] = {};

  try {
      const snap = await db.collection("employeescomnew").where("center", "==", selectedCenterName).get();
      if (!snap.empty) {
          snap.forEach(doc => {
              const tr = doc.data();
              const rawGrade = tr.grade || tr.rank || "";
              const rawMaty = tr.maty || tr.specialty || "";
              
              if (rawGrade || rawMaty) {
                  const lvl = resolveLevel(rawGrade);
                  const spc = resolveSpecialization(rawMaty);
                  
                  if (!SITE_SETTINGS.dbLinks[centerId][lvl.key]) {
                      SITE_SETTINGS.dbLinks[centerId][lvl.key] = {};
                      newSyncNeeded = true;
                  }
                  
                  if (!SITE_SETTINGS.dbLinks[centerId][lvl.key][spc.key]) {
                      SITE_SETTINGS.dbLinks[centerId][lvl.key][spc.key] = { videos: [] };
                      for (let mod in (SITE_SETTINGS.MODULE_CYCLE_STATUS || {})) {
                          SITE_SETTINGS.dbLinks[centerId][lvl.key][spc.key][mod] = { 1: "", 2: "", 3: "" };
                      }
                      newSyncNeeded = true;
                  }
                  
                  // ضمان وجود الأسماء في UI_NAMES
                  if (!SITE_SETTINGS.UI_NAMES.levels[lvl.key]) {
                      SITE_SETTINGS.UI_NAMES.levels[lvl.key] = lvl.name;
                      newSyncNeeded = true;
                  }
                  if (!SITE_SETTINGS.UI_NAMES.specs[spc.key]) {
                      SITE_SETTINGS.UI_NAMES.specs[spc.key] = spc.name;
                      newSyncNeeded = true;
                  }
              }
          });
          
          if (newSyncNeeded) {
              // حفظ التحديث في الخلفية
              db.collection("site_settings").doc("main").update({
                  [`dbLinks.${centerId}`]: SITE_SETTINGS.dbLinks[centerId],
                  "UI_NAMES.levels": SITE_SETTINGS.UI_NAMES.levels,
                  "UI_NAMES.specs": SITE_SETTINGS.UI_NAMES.specs
              }).catch(e => console.warn("تحديث تلقائي لهيكلة المركز:", e));
          }
      }
  } catch (err) {
      console.warn("خطأ فحص قاعدة بيانات المتكونين للمركز:", err);
  }

  Swal.close();

  const centerLinks = SITE_SETTINGS.dbLinks[centerId] || {};
  const availableLevels = Object.keys(centerLinks);

  if (availableLevels.length === 0) {
      Swal.fire('تنبيه', 'لا توجد أطوار مبرمجة في هذا المركز حالياً. يرجى إضافتها من إعدادات المديرية أو تسجيل متكونين في المركز.', 'info');
      return;
  }

  if (availableLevels.length === 1) {
      showSpecsModal(centerId, availableLevels[0], false);
  } else {
      showLevelsModal(centerId, availableLevels);
  }
}

function showLevelsModal(centerId, availableLevels) {
    let html = '<div class="icon-container">';
    
    availableLevels.forEach(lvlId => {
        const allLevels = getIconsLevels();
        let defaultIcon = allLevels[lvlId] ? allLevels[lvlId].icon : 'fa-layer-group';
        let defaultName = allLevels[lvlId] ? allLevels[lvlId].name : lvlId;
        
        let levelName = (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels && SITE_SETTINGS.UI_NAMES.levels[lvlId]) 
                        ? SITE_SETTINGS.UI_NAMES.levels[lvlId] 
                        : defaultName;

        html += `
          <div class="icon-btn" onclick="showSpecsModal('${centerId}', '${lvlId}', true)">
            <i class="fa-solid ${defaultIcon}"></i>
            <span>${levelName}</span>
          </div>`;
    });
    
    html += '</div>';

    Swal.fire({
        title: 'اختر الطور المستهدف:',
        html: html,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#939393',
        scrollbarPadding: false
    });
}

function showSpecsModal(centerId, lvlId, showBackButton) {
    const specsData = SITE_SETTINGS.dbLinks[centerId][lvlId] || {};
    const availableSpecs = Object.keys(specsData);

    if (availableSpecs.length === 0) {
        Swal.fire('تنبيه', 'لا توجد تخصصات مبرمجة لهذا الطور.', 'info');
        return;
    }

    const allLevels = getIconsLevels();
    const levelName = allLevels[lvlId] ? allLevels[lvlId].name : lvlId;

    let html = '<div class="icon-container">';
    
    availableSpecs.forEach(spcId => {
        const allSpecs = getIconsSpecs();
        let spcInfo = allSpecs[spcId] || { name: spcId, icon: 'fa-book' };
        html += `
          <div class="icon-btn" onclick="openLink('${centerId}', '${lvlId}', '${spcId}')">
            <i class="fa-solid ${spcInfo.icon}"></i>
            <span>${spcInfo.name}</span>
          </div>`;
    });
    
    html += '</div>';

    let options = {
        title: `<div style="color: #1E68E8; font-size: 20px; font-weight: bold; border-bottom: 2px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
                    <i class="fa-solid fa-layer-group"></i> ${levelName}
                </div>
                <div style="color: #475569; font-size: 16px;">يرجى اختيار التخصص المناسب:</div>`,
        html: html,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#939393',
        scrollbarPadding: false
    };

    if (showBackButton) {
        options.showDenyButton = true;
        options.denyButtonText = '<i class="fa-solid fa-arrow-right"></i> تراجع للوراء';
        options.denyButtonColor = '#1E68E8';
    }

    Swal.fire(options).then((result) => {
        if (result.isDenied && showBackButton) {
            const availableLevels = Object.keys(SITE_SETTINGS.dbLinks[centerId]);
            showLevelsModal(centerId, availableLevels);
        }
    });
}

function openLink(centerId, levelId, specId) {
    const basePath = (window.location.protocol === "file:") ? "manage_courses.html" : "/courses-manage";
    window.location.href = `${basePath}?c=${centerId}&l=${levelId}&s=${specId}`;
}

// ==================== 4. تأثير الكتابة السلسة ====================
const textToType = "الجمهورية الجزائرية الديمقراطية الشعبية | وزارة التربية الوطنية | مديرية التربية لولاية توقرت";
const typeWriterElement = document.getElementById('typewriter-text');
let charIndex = 0;

function typeWriter() {
    if (charIndex < textToType.length) {
        typeWriterElement.innerHTML += textToType.charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, 45); 
    } else {
        setTimeout(startFadeOut, 3000); 
    }
}

function startFadeOut() {
    typeWriterElement.classList.add('fade-out');
    setTimeout(() => {
        typeWriterElement.innerHTML = "";
        charIndex = 0;
        typeWriterElement.classList.remove('fade-out'); 
        setTimeout(typeWriter, 500); 
    }, 1000);
}

window.onload = async function() { 
    typeWriter(); 

    // إذا كانت الجلسة معتمدة لدى المفتش أو المديرية، نبدأ فوراً
    if (userEmpId) {
        const hasPermission = await checkUserPermissions();
        if (hasPermission) {
            initSiteSettings();
        }
    } else {
        window.location.href = "/login";
        return;
    }

    // التحقق التلقائي الإضافي لحساب المديرية في فايربيز إن وجد
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user && user.email === "admin_directorate@system.local") {
            userEmpId = "ADMIN_ACCESS";
            sessionStorage.setItem("userEmpId", "ADMIN_ACCESS");
            if (!SITE_SETTINGS) {
                const hasPermission = await checkUserPermissions();
                if (hasPermission) {
                    initSiteSettings();
                }
            }
        }
    });
};