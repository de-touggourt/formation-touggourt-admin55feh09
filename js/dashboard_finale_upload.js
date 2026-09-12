// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}
// ==================== 1. الحماية وإعدادات الجلسة ====================
let userEmpId = sessionStorage.getItem("userEmpId");
let inspectorCenter = sessionStorage.getItem("inspectorCenter");

// تم حذف سطر الطرد المباشر لأنه يعمل قبل التحقق من فايربيز

function goBack() {
    if (userEmpId === "ADMIN_ACCESS") window.location.href = "admin_dashboard.html";
    else window.location.href = "inspector_dashboard.html";
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
                        window.location.href = "inspector_dashboard.html";
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

// تعريف الأيقونات الثابتة للأطوار والتخصصات
const ICONS = {
    levels: {
        'primary': { name: 'الطور الابتدائي', icon: 'fa-child-reaching' },
        'middle': { name: 'الطور المتوسط', icon: 'fa-school' },
        'secondary': { name: 'الطور الثانوي', icon: 'fa-user-graduate' }
    },
    specs: {
        'arabic': { name: 'اللغة العربية', icon: 'fa-book-open' },
        'french': { name: 'اللغة الفرنسية', icon: 'fa-language' },
        'english': { name: 'اللغة الإنجليزية', icon: 'fa-font' },
        'sport': { name: 'التربية البدنية والرياضة', icon: 'fa-person-running' },
        'others': { name: 'باقي التخصصات', icon: 'fa-layer-group' }
    }
};

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
                            window.location.href = "inspector_dashboard.html"; 
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

function openCenter(centerId) {
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

  const centerLinks = SITE_SETTINGS.dbLinks[centerId] || {};
  const availableLevels = Object.keys(centerLinks);

  if (availableLevels.length === 0) {
      Swal.fire('تنبيه', 'لا توجد أطوار مبرمجة في هذا المركز حالياً. يرجى إضافتها من إعدادات المديرية.', 'info');
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
        let defaultIcon = 'fa-layer-group';
        let defaultName = lvlId;
        
        if (ICONS.levels[lvlId]) {
            defaultIcon = ICONS.levels[lvlId].icon;
            defaultName = ICONS.levels[lvlId].name;
        }
        
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

    const levelName = SITE_SETTINGS.UI_NAMES.levels[lvlId] || (ICONS.levels[lvlId] ? ICONS.levels[lvlId].name : lvlId);

    let html = '<div class="icon-container">';
    
    availableSpecs.forEach(spcId => {
        let spcInfo = ICONS.specs[spcId] || { name: spcId, icon: 'fa-book' };
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
    window.location.href = `manage_courses.html?c=${centerId}&l=${levelId}&s=${specId}`;
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

    // ننتظر تحقق سيرفر فايربيز أولاً بدلاً من التسرع في الطرد
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // 🌟 التعرف التلقائي على حساب المديرية ومنحه الصلاحية الشاملة 🌟
            if (user.email === "admin_directorate@system.local") {
                userEmpId = "ADMIN_ACCESS";
                sessionStorage.setItem("userEmpId", "ADMIN_ACCESS");
            }

            // الآن، إذا كان لا يزال مجهولاً، نقوم بطرده
            if (!userEmpId) { 
                window.location.href = "admin095526.html"; 
                return; 
            }

            const hasPermission = await checkUserPermissions();
            if (hasPermission) {
                initSiteSettings();
            }
        } else {
            window.location.href = "admin095526.html";
        }
    });
};