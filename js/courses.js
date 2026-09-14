/* ==========================================
   إعدادات التحكم والنصوص
   ========================================== */
const SHOW_DRIVE_BUTTON = false; 
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

/* =========================================
   متغيرات النظام و Firebase
   ========================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let loggedInUser = null;
let SITE_SETTINGS = null;
const PHOTO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSe-P_rRLZ0iiQtC1oB9mAkaNJ3b1r0pUsWpQgPznW4k5mItoMxlPjROd9wpev6rUjBw/exec";

// جلب البارامترات
const params = new URLSearchParams(window.location.search);
const cId = params.get('c');
const lvl = params.get('l');
const spc = params.get('s');

// جلب الروابط
let currentLinks = {};
if(typeof dbLinks !== 'undefined' && dbLinks[cId] && dbLinks[cId][lvl] && dbLinks[cId][lvl][spc]) {
    currentLinks = dbLinks[cId][lvl][spc];
}

function isCycleOpen(module, cycle) {
  if (typeof SITE_SETTINGS !== 'undefined' && SITE_SETTINGS) {
    if (SITE_SETTINGS.GLOBAL_CYCLE_STATUS) {
      if (SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] === false) return false;
    }
    if (SITE_SETTINGS.MODULE_CYCLE_STATUS && SITE_SETTINGS.MODULE_CYCLE_STATUS[module]) {
      if (typeof SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle] !== 'undefined') {
        return !!SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle];
      }
    }
    return cycle === 1;
  }
  if (typeof GLOBAL_CYCLE_STATUS !== 'undefined' && GLOBAL_CYCLE_STATUS[cycle] === false) return false;
  if (typeof MODULE_CYCLE_STATUS !== 'undefined' && MODULE_CYCLE_STATUS[module]) {
    if (typeof MODULE_CYCLE_STATUS[module][cycle] !== 'undefined') {
      return !!MODULE_CYCLE_STATUS[module][cycle];
    }
  }
  return cycle === 1;
}

function getFolderId(url) {
    if (!url) return null;
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function extractCoreId(val) {
    if (!val) return "";
    let str = String(val).trim().toUpperCase();
    let digitsOnly = str.replace(/\D/g, "");
    let core = digitsOnly.replace(/^0+/, ""); 
    return core === "" ? digitsOnly : core;
}

/* =======================================================
   دالة جلب بيانات المستخدم والصورة عند التحميل
   ======================================================= */
window.onload = async function() {
    if (window.SecurityGuard && !SecurityGuard.verifySession()) return;
    typeWriter();
    
    const empId = sessionStorage.getItem("userEmpId");
    if(!empId) { window.location.href = "/login"; return; }

    try {
        // 1. جلب بيانات المستخدم
        let docSnap = await db.collection("employeescomnew").doc(empId).get();
        if(docSnap.exists) {
            loggedInUser = docSnap.data();
        } else {
            let q = await db.collection("employeescomnew").where("id", "==", empId).get();
            if(!q.empty) loggedInUser = q.docs[0].data();
        }

        if(!loggedInUser) {
            Swal.fire('خطأ', 'لم يتم العثور على بياناتك.', 'error').then(()=>window.location.href="/login");
            return;
        }

        document.getElementById('userNameDisplay').innerText = loggedInUser.name || 'مستخدم مجهول';
        document.getElementById('userRankDisplay').innerText = loggedInUser.grade || loggedInUser.rank || 'رتبة غير محددة';
        // 🌟 عرض التخصص للمتكون 🌟
        if(document.getElementById('userSpecDisplay')) {
            document.getElementById('userSpecDisplay').innerText = loggedInUser.maty || loggedInUser.specialty || 'تخصص غير محدد';
        }
        document.getElementById('userWorkplaceDisplay').innerText = loggedInUser.place || loggedInUser.workplace || 'مكان العمل غير محدد';

        // الصورة الشخصية
                // 🌟 1. استرجاع وعرض الصورة فوراً من الكاش المحلي في 0 جزء من الثانية 🌟
        const avatarBox = document.getElementById('userAvatarContainer');
        const coreId = extractCoreId(empId);
        
        const localCachedAvatar = localStorage.getItem("user_avatar_" + coreId);
        if (localCachedAvatar) {
            avatarBox.innerHTML = `<img src="${localCachedAvatar}" alt="الصورة الشخصية" referrerpolicy="no-referrer" onerror="window.handleAvatarFallback(this, '')">`;
        }

        // 🌟 2. التحقق من وجود صورة فايربيز / ImgBB أو درايف وتحديث العرض 🌟
        if (loggedInUser.photoUrl_fb) {
            let imgUrl = loggedInUser.photoUrl_fb;
            if (imgUrl.includes('sz=w200')) imgUrl = imgUrl.replace('sz=w200', 'sz=w800');
            if (imgUrl.includes('=s200')) imgUrl = imgUrl.replace('=s200', '=s800');
            
            try {
                localStorage.setItem("user_avatar_" + coreId, imgUrl);
            } catch(e) {}

            avatarBox.innerHTML = `<img src="${imgUrl}" alt="الصورة الشخصية" referrerpolicy="no-referrer" onerror="fetchPhotosFromDrive('${coreId}', document.getElementById('userAvatarContainer'))">`;
        } else {
            // جلب وتحديث صورة درايف في الخلفية دون تعطيل الواجهة
            fetchPhotosFromDrive(coreId, avatarBox);
        }

        // 2. 🌟 جلب إعدادات الموقع والعناوين وروابط المقاييس من Firestore مباشرة 🌟
        const settingsDoc = await db.collection("site_settings").doc("main").get();
        if (settingsDoc.exists) {
            SITE_SETTINGS = settingsDoc.data();
            
            const params = new URLSearchParams(window.location.search);
            const cId = params.get('c');
            const lvl = params.get('l');
            const spc = params.get('s');

            if (cId && lvl && spc) {
                // تعيين اسم المركز
                const centerName = SITE_SETTINGS.UI_NAMES.centers[cId] || "";
                document.getElementById('page-title').innerText = "مركز التكوين " + centerName;
                
                // تعيين اسم الطور
                let levelText = "";
                if (lvl === 'primary') levelText = "أساتذة التعليم الابتدائي";
                else if (lvl === 'middle') levelText = "أساتذة التعليم المتوسط";
                else if (lvl === 'secondary') levelText = "أساتذة التعليم الثانوي";
                else levelText = (SITE_SETTINGS.UI_NAMES.levels && SITE_SETTINGS.UI_NAMES.levels[lvl]) || lvl;

                // تعيين اسم التخصص
                let specText = (SITE_SETTINGS.UI_NAMES.specs && SITE_SETTINGS.UI_NAMES.specs[spc]) || spc;
                document.getElementById('page-subtitle').innerText = levelText + " - " + specText;

                // 🌟 حصر المتكون للدخول إلى ملفات تخصصه المعتمد فقط 🌟
                const userRole = sessionStorage.getItem("userRole");
                if (userRole === "USER" || !sessionStorage.getItem("inspectorCenter")) {
                    const detected = detectUserLevelAndSpec(loggedInUser);
                    if (detected.specKey && spc && detected.specKey !== spc) {
                        document.getElementById("loader").style.display = "none";
                        Swal.fire({
                            icon: 'warning',
                            title: '<h3 style="color:#e67e22; margin:0; font-family:\'Cairo\';"><i class="fa-solid fa-lock"></i> وصول مقيد بالتخصص</h3>',
                            html: `
                                <div style="font-size:15px; line-height:1.8; color:#334e68; padding:10px 0; font-family:\'Cairo\';">
                                    أستاذ(ة) محترم(ة): <b>${loggedInUser.name || ''}</b><br>
                                    النظام يحصر وصول المتكونين في ملفات مادة تخصصهم المعتمدة حصراً.<br>
                                    <div style="background:#fff3cd; border:1px solid #ffeeba; border-radius:10px; padding:10px; margin:15px 0; color:#856404; font-weight:bold;">
                                        تخصصك المعتمد هو: ${loggedInUser.maty || loggedInUser.specialty || 'تخصصك المعتمد'}
                                    </div>
                                    جاري توجيهك إلى مقاييس تخصصك...
                                </div>
                            `,
                            confirmButtonColor: '#0FBA50',
                            confirmButtonText: 'الدخول لمقاييس تخصصي',
                            allowOutsideClick: false
                        }).then(() => {
                            window.location.replace(`/courses?c=${cId}&l=${detected.levelKey || lvl}&s=${detected.specKey}`);
                        });
                        return;
                    }
                }

                // جلب الروابط الخاصة بهذا المقياس
                if (SITE_SETTINGS.dbLinks && SITE_SETTINGS.dbLinks[cId] && SITE_SETTINGS.dbLinks[cId][lvl] && SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
                    currentLinks = SITE_SETTINGS.dbLinks[cId][lvl][spc];
                }

                // 🌟 تفعيل فحص وإظهار إشعارات أعداد الملفات على أيقونات المقاييس 🌟
                updateModuleFileBadges();
            }
        }

        document.getElementById("loader").style.display = "none";

    } catch (e) {
        console.error(e);
        document.getElementById("loader").style.display = "none";
        Swal.fire('خطأ', 'تعذر الاتصال بقاعدة البيانات.', 'error');
    }
};

// ================= دالة كشف الطور والتخصص بدقة =================
function detectUserLevelAndSpec(user) {
    if (!user) return { levelKey: null, specKey: null };
    
    // الطور
    const rankStr = (user.grade || user.rank || "").toLowerCase();
    let levelKey = null;
    if (rankStr.includes("ابتدائي")) levelKey = "primary";
    else if (rankStr.includes("متوسط")) levelKey = "middle";
    else if (rankStr.includes("ثانوي")) levelKey = "secondary";
    
    // التخصص
    const matyStr = (user.maty || user.specialty || "").trim().toLowerCase();
    let specKey = "others";
    if (matyStr.includes("عرب")) specKey = "arabic";
    else if (matyStr.includes("فرنس")) specKey = "french";
    else if (matyStr.includes("إنجليز") || matyStr.includes("انجليز")) specKey = "english";
    else if (matyStr.includes("بدن") || matyStr.includes("رياض")) specKey = "sport";
    else if (matyStr) specKey = "others";

    return { levelKey, specKey, rawLevel: user.grade || user.rank, rawSpec: user.maty || user.specialty };
}

// ================= دالة الإنقاذ الذكية لصورة المتكون =================
window.handleAvatarFallback = function(imgElement, fallbackUrl) {
    if (fallbackUrl && fallbackUrl !== 'undefined' && fallbackUrl !== 'null' && imgElement.src !== fallbackUrl && !imgElement.getAttribute('data-retried')) {
        imgElement.setAttribute('data-retried', 'true');
        imgElement.src = fallbackUrl;
    } else {
        imgElement.outerHTML = '<i class="fa-solid fa-user"></i>';
    }
};

// ================= دالة جلب الصورة من درايف =================
async function fetchPhotosFromDrive(coreId, avatarBox) {
    try {
        const cacheBusterUrl = `${PHOTO_SCRIPT_URL}?type=employees&_t=${Date.now()}`;
        let res = await fetch(cacheBusterUrl, { cache: "no-store" });
        let text = await res.text();
        
        if (text && text.includes("[")) {
            let photoData = JSON.parse(text);
            let userPhotoObj = photoData.find(item => extractCoreId(item.jobId) === coreId);
            
            if (userPhotoObj && userPhotoObj.photoUrl) {
                let directUrl = userPhotoObj.photoUrl;
                const match = directUrl.match(/id=([a-zA-Z0-9_-]+)/) || directUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                
                let lh3Url = directUrl;
                let thumbUrl = directUrl;

                if (match) {
                    lh3Url = `https://lh3.googleusercontent.com/d/${match[1]}=s800`;
                    thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
                }

                try {
                    localStorage.setItem("user_avatar_" + coreId, lh3Url);
                } catch(e) {}

                avatarBox.innerHTML = `<img src="${lh3Url}" alt="الصورة الشخصية" referrerpolicy="no-referrer" onerror="window.handleAvatarFallback(this, '${thumbUrl}')">`;
            }
        }
    } catch(e) { 
        console.warn("تعذر تحديث صورة درايف من السيرفر:", e); 
    }
}

// ================= إعدادات وتحديث إشعارات أعداد الملفات لكل مقياس =================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_eNgM1R-fILJq00iye9-3eeFCFjKBkMcej4VOq53gG5gshOsulAH7b-X0_JkHHrkyJw/exec"; 
const MODULE_KEYS = ['didactique', 'tasyire', 'takwime', 'informatique', 'nidame', 'akhlakiyate', 'handasa', 'wasata', 'tachri', 'psycho', 'fasad'];

async function updateModuleFileBadges() {
    if (!currentLinks) return;

    for (const mod of MODULE_KEYS) {
        const badgeEl = document.getElementById(`badge_${mod}`);
        if (!badgeEl) continue;

        const modCycles = currentLinks[mod] || {};
        let folderIdsToCheck = [];

        // جمع مجلدات الدورات المفتوحة فقط
        for (let cycle = 1; cycle <= 3; cycle++) {
            if (isCycleOpen(mod, cycle) && modCycles[cycle]) {
                const fId = getFolderId(modCycles[cycle]);
                if (fId) folderIdsToCheck.push({ cycle, folderId: fId });
            }
        }

        if (folderIdsToCheck.length === 0) {
            badgeEl.className = "module-files-badge";
            badgeEl.innerHTML = `<i class="fa-solid fa-lock"></i> <span class="count-txt">مغلق</span>`;
            continue;
        }

        // فحص الكاش السريع في الجلسة أولاً
        let totalFiles = 0;
        let hasCache = true;
        for (const item of folderIdsToCheck) {
            const cached = sessionStorage.getItem(`files_count_${item.folderId}`);
            if (cached !== null) {
                totalFiles += parseInt(cached, 10);
            } else {
                hasCache = false;
                break;
            }
        }

        if (hasCache) {
            renderBadgeState(badgeEl, totalFiles);
        } else {
            // جلب أعداد الملفات في الخلفية بدون تأخير الواجهة
            fetchModuleFilesCount(mod, folderIdsToCheck, badgeEl);
        }
    }
}

async function fetchModuleFilesCount(mod, folderList, badgeEl) {
    let count = 0;
    try {
        const promises = folderList.map(item => 
            fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${item.folderId}`)
                .then(r => r.json())
                .then(d => {
                    const c = (d && d.files && Array.isArray(d.files)) ? d.files.length : 0;
                    sessionStorage.setItem(`files_count_${item.folderId}`, c);
                    if (d && d.files) {
                        sessionStorage.setItem(`files_data_${item.folderId}`, JSON.stringify(d.files));
                    }
                    return c;
                })
                .catch(() => 0)
        );

        const results = await Promise.all(promises);
        count = results.reduce((acc, curr) => acc + curr, 0);
        renderBadgeState(badgeEl, count);
    } catch(e) {
        badgeEl.className = "module-files-badge";
        badgeEl.innerHTML = `<i class="fa-solid fa-folder-open"></i> <span class="count-txt">متوفر</span>`;
    }
}

function renderBadgeState(badgeEl, count) {
    if (count > 0) {
        badgeEl.className = "module-files-badge has-files is-new";
        badgeEl.innerHTML = `<i class="fa-solid fa-file-circle-check"></i> <span class="count-txt">${count} ملف</span>`;
    } else {
        badgeEl.className = "module-files-badge";
        badgeEl.innerHTML = `<i class="fa-solid fa-folder-open"></i> <span class="count-txt">0 ملف</span>`;
    }
}

/* =======================================================
   دوال فتح الدورات والمستعرض المتطور للملفات
   ======================================================= */
window.openCourses = function(module) {
  let html = '<div class="cycles-container">';
  for(let i=1; i<=3; i++) {
    const open = isCycleOpen(module, i);
    let cycleName = i===1 ? 'الأولى' : i===2 ? 'الثانية' : 'الثالثة';
    
    html += `
      <div class="cycle-btn ${open ? '' : 'closed'}" onclick="${open ? `showDriveEmbed('${module}',${i})` : ''}">
        الدورة ${cycleName}
        <span class="cycle-badge ${open ? 'open' : 'closed'}">
          ${open ? '<i class="fa-solid fa-unlock"></i> مفتوحة' : '<i class="fa-solid fa-lock"></i> مغلقة'}
        </span>
      </div>`;
  }
  html += '</div>';

  Swal.fire({
    title: '<i class="fa-solid fa-folder-open" style="color:#0FBA50;"></i> اختر الدورة التكوينية',
    html: html, showConfirmButton: true, confirmButtonText: 'إغلاق', width: '550px'
  });
};

// ================= مستعرض الملفات العصري والاحترافي (بديل الأي فريم القديم) =================
let activeExplorerFiles = [];

window.showDriveEmbed = async function(module, cycle) {
  const url = (currentLinks[module] && currentLinks[module][cycle]) ? currentLinks[module][cycle] : "";
  const folderId = getFolderId(url);

  if (!url || !folderId) {
    return Swal.fire({ icon: 'info', title: 'قريباً', text: 'ملفات هذه الدورة غير متوفرة حالياً.', confirmButtonColor: '#0FBA50' });
  }

  const cycleTitle = cycle === 1 ? 'الأولى' : cycle === 2 ? 'الثانية' : 'الثالثة';

  // إظهار نافذة التحميل العصرية
  Swal.fire({
    title: `ملفات الدورة ${cycleTitle}`,
    html: `
      <div style="padding: 30px; text-align:center;">
        <div class="spinner" style="margin: 0 auto 15px auto;"></div>
        <p style="color:#0FBA50; font-weight:bold; font-size:15px; margin:0;">جاري جلب الملفات المرفوعة من Google Drive...</p>
      </div>
    `,
    showConfirmButton: false,
    allowOutsideClick: false,
    width: '850px'
  });

  try {
    // التحقق من كاش الملفات السريع
    let files = [];
    const cachedData = sessionStorage.getItem(`files_data_${folderId}`);
    if (cachedData) {
      files = JSON.parse(cachedData);
    } else {
      let res = await fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`);
      let data = await res.json();
      if (data && data.files && Array.isArray(data.files)) {
        files = data.files;
        sessionStorage.setItem(`files_data_${folderId}`, JSON.stringify(files));
        sessionStorage.setItem(`files_count_${folderId}`, files.length);
      }
    }

    renderModernFilesModal(module, cycle, folderId, url, files);

  } catch (err) {
    console.warn("تعذر قراءة الملفات عبر السكريبت:", err);
    // في حال تعذر السكريبت، نوفر خيار المعاينة أو الفتح المباشر
    Swal.fire({
      icon: 'info',
      title: `ملفات الدورة ${cycleTitle}`,
      html: `
        <div style="padding: 20px; text-align:center; direction:rtl;">
          <p style="font-size:15px; color:#475569; margin-bottom:20px;">يمكنك الاطلاع على محتويات وتحميل ملفات هذه الدورة مباشرة عبر Google Drive:</p>
          <a href="${url}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; background:#0FBA50; color:#fff; padding:12px 24px; border-radius:12px; text-decoration:none; font-weight:bold; font-size:15px; box-shadow:0 4px 15px rgba(15,186,80,0.3);">
            <i class="fa-brands fa-google-drive"></i> فتح مجلد الدورة في Google Drive
          </a>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'إغلاق',
      showDenyButton: true,
      denyButtonText: 'رجوع للدورات',
      denyButtonColor: '#64748b'
    }).then((res) => { if (res.isDenied) openCourses(module); });
  }
};

function renderModernFilesModal(module, cycle, folderId, driveUrl, files) {
  activeExplorerFiles = files || [];
  const cycleTitle = cycle === 1 ? 'الأولى' : cycle === 2 ? 'الثانية' : 'الثالثة';

  const modalHtml = `
    <div class="files-explorer-modal">
      <div class="files-explorer-header">
        <input type="text" id="explorerSearchInput" class="explorer-search-input" placeholder="🔍 بحث في ملفات المقياس..." oninput="filterExplorerFiles(this.value)">
        <span class="explorer-stats-badge" id="explorerStatsBadge">${activeExplorerFiles.length} ملف متوفر</span>
      </div>

      <div class="files-grid-container" id="filesCardsContainer">
        ${buildFilesCardsHtml(activeExplorerFiles)}
      </div>

      <div style="text-align:left; border-top:1px dashed #cbd5e1; padding-top:12px; margin-top:5px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <span style="font-size:12px; color:#64748b;"><i class="fa-solid fa-cloud-check"></i> متصل بالسحابة عبر Google Drive</span>
        <a href="${driveUrl}" target="_blank" style="color:#0FBA50; font-weight:700; font-size:13px; text-decoration:none; display:flex; align-items:center; gap:6px;">
          <i class="fa-brands fa-google-drive"></i> فتح المجلد السحابي الكامل
        </a>
      </div>
    </div>
  `;

  Swal.fire({
    title: `<div style="display:flex; align-items:center; gap:10px; font-family:'Cairo';"><i class="fa-solid fa-folder-tree" style="color:#0FBA50;"></i> ملفات الدورة ${cycleTitle}</div>`,
    html: modalHtml,
    width: '920px',
    showConfirmButton: true,
    confirmButtonText: 'إغلاق',
    showDenyButton: true,
    denyButtonText: 'رجوع للدورات',
    denyButtonColor: '#64748b',
    scrollbarPadding: false
  }).then((res) => {
    if (res.isDenied) openCourses(module);
  });
}

function getFileTypeInfo(name, type) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = (type || '').toLowerCase();

    if (ext === 'pdf' || mime.includes('pdf')) {
        return { icon: 'fa-file-pdf', css: 'file-icon-pdf', label: 'PDF' };
    } else if (['doc', 'docx'].includes(ext) || mime.includes('word')) {
        return { icon: 'fa-file-word', css: 'file-icon-word', label: 'WORD' };
    } else if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('sheet') || mime.includes('excel')) {
        return { icon: 'fa-file-excel', css: 'file-icon-excel', label: 'EXCEL' };
    } else if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
        return { icon: 'fa-file-powerpoint', css: 'file-icon-ppt', label: 'PPT' };
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mime.includes('image')) {
        return { icon: 'fa-file-image', css: 'file-icon-image', label: 'IMG' };
    } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
        return { icon: 'fa-file-zipper', css: 'file-icon-archive', label: 'ZIP' };
    } else {
        return { icon: 'fa-file-lines', css: 'file-icon-default', label: ext.toUpperCase() || 'FILE' };
    }
}

function buildFilesCardsHtml(filesList) {
    if (!filesList || filesList.length === 0) {
        return `
            <div style="grid-column: 1/-1; text-align:center; padding: 40px 20px; color:#64748b;">
                <i class="fa-regular fa-folder-open" style="font-size: 45px; color:#cbd5e1; margin-bottom:10px;"></i>
                <p style="font-size:15px; font-weight:700; margin:0;">المجلد فارغ حالياً أو لم يتم العثور على ملفات مطابقة.</p>
            </div>
        `;
    }

    return filesList.map(file => {
        const typeInfo = getFileTypeInfo(file.name, file.type);
        const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        return `
            <div class="file-card-modern">
                <div class="file-top-info">
                    <div class="file-icon-box ${typeInfo.css}">
                        <i class="fa-solid ${typeInfo.icon}"></i>
                    </div>
                    <div class="file-text-content">
                        <div class="file-title-text" title="${file.name}">${file.name}</div>
                        <div class="file-meta-row">
                            <span class="file-ext-tag">${typeInfo.label}</span>
                            <span><i class="fa-solid fa-cloud-arrow-down"></i> جاهز للتحميل</span>
                        </div>
                    </div>
                </div>
                <div class="file-actions-row">
                    <a href="${previewUrl}" target="_blank" class="btn-file-action btn-preview-action">
                        <i class="fa-solid fa-eye"></i> معاينة
                    </a>
                    <a href="${downloadUrl}" target="_blank" class="btn-file-action btn-download-action">
                        <i class="fa-solid fa-download"></i> تحميل
                    </a>
                </div>
            </div>
        `;
    }).join('');
}

window.filterExplorerFiles = function(query) {
    const q = (query || '').trim().toLowerCase();
    const container = document.getElementById('filesCardsContainer');
    const badge = document.getElementById('explorerStatsBadge');
    if (!container) return;

    const filtered = activeExplorerFiles.filter(f => f.name.toLowerCase().includes(q));
    container.innerHTML = buildFilesCardsHtml(filtered);
    if (badge) {
        badge.innerText = `${filtered.length} من أصل ${activeExplorerFiles.length} ملف`;
    }
};

window.handleLessonsClick = function() {
  const videoData = (currentLinks && currentLinks.videos) ? currentLinks.videos : [];
  if(videoData.length === 0) return Swal.fire({ icon: 'info', title: 'تنبيه', text: 'لا توجد دروس مرئية متوفرة حالياً.', confirmButtonColor: '#0FBA50' });

  let listHtml = '<div class="video-list-container">';
  let hasVideos = false;
  
  videoData.forEach((video) => {
    if(video.url && video.url.trim() !== "") {
        hasVideos = true;
        listHtml += `
          <div class="video-btn" onclick="playVideo('${video.url}', '${video.title}')">
            <span>${video.title}</span><i class="fa-solid fa-play-circle"></i>
          </div>`;
    }
  });
  listHtml += '</div>';

  if(!hasVideos) return Swal.fire({ icon: 'info', title: 'قريباً', text: 'الروابط قيد التحديث.', confirmButtonColor: '#0FBA50' });

  Swal.fire({ title: '<i class="fa-solid fa-film" style="color:#1E68E8;"></i> الدروس التطبيقية', html: listHtml, showConfirmButton: true, confirmButtonText: 'إغلاق', width: '550px' });
};

window.playVideo = function(url, title) {
  if(!url) return;
  const previewUrl = url.replace(/\/view.*/, '/preview');

  Swal.fire({
    title: title,
    html: `
      <div class="video-wrapper">
        <div id="videoLoader" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); z-index:1;"><div class="spinner"></div></div>
        <iframe src="${previewUrl}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen onload="document.getElementById('videoLoader').style.display='none';" style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 2;"></iframe>
      </div>
    `,
    width: '800px', showCloseButton: false, showConfirmButton: false, showDenyButton: true, denyButtonText: 'عودة للقائمة', denyButtonColor: '#0FBA50',
  }).then((result) => { if (result.isDenied) handleLessonsClick(); });
};