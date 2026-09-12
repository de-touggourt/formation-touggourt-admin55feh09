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
    if (SITE_SETTINGS.GLOBAL_CYCLE_STATUS && !SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle]) return false;
    if (SITE_SETTINGS.MODULE_CYCLE_STATUS && SITE_SETTINGS.MODULE_CYCLE_STATUS[module]) {
      return !!SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle];
    }
  }
  if (typeof GLOBAL_CYCLE_STATUS !== 'undefined' && !GLOBAL_CYCLE_STATUS[cycle]) return false;
  if (typeof MODULE_CYCLE_STATUS !== 'undefined' && MODULE_CYCLE_STATUS[module]) {
    return !!MODULE_CYCLE_STATUS[module][cycle];
  }
  return false;
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
    if(!empId) { window.location.href = "index.html"; return; }

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
            Swal.fire('خطأ', 'لم يتم العثور على بياناتك.', 'error').then(()=>window.location.href="index.html");
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
            const SITE_SETTINGS = settingsDoc.data();
            
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

                // جلب الروابط الخاصة بهذا المقياس
                if (SITE_SETTINGS.dbLinks && SITE_SETTINGS.dbLinks[cId] && SITE_SETTINGS.dbLinks[cId][lvl] && SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
                    currentLinks = SITE_SETTINGS.dbLinks[cId][lvl][spc];
                }
            }
        }

        document.getElementById("loader").style.display = "none";

    } catch (e) {
        console.error(e);
        document.getElementById("loader").style.display = "none";
        Swal.fire('خطأ', 'تعذر الاتصال بقاعدة البيانات.', 'error');
    }
};

// ================= دالة الإنقاذ الذكية لصورة المتكون =================
window.handleAvatarFallback = function(imgElement, fallbackUrl) {
    if (fallbackUrl && fallbackUrl !== 'undefined' && fallbackUrl !== 'null' && imgElement.src !== fallbackUrl && !imgElement.getAttribute('data-retried')) {
        imgElement.setAttribute('data-retried', 'true');
        imgElement.src = fallbackUrl;
    } else {
        imgElement.outerHTML = '<i class="fa-solid fa-user"></i>';
    }
};

// ================= دالة جلب الصورة من درايف (فائقة السرعة ومحصنة ضد أخطاء الكاش) =================
async function fetchPhotosFromDrive(coreId, avatarBox) {
    try {
        // 🌟 1. كاسر الكاش (_t) لمنع خطأ CORS عند التحديث F5 🌟
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

                // 🌟 2. استخدام سيرفر lh3 الفائق بدقة s800 مع توفير رابط بديل 🌟
                if (match) {
                    lh3Url = `https://lh3.googleusercontent.com/d/${match[1]}=s800`;
                    thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
                }

                // 🌟 3. حفظ الصورة في كاش المتصفح المحلي لتظهر فوراً في المرات القادمة 🌟
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

/* =======================================================
   دوال فتح الدرايف والفيديوهات
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

window.showDriveEmbed = function(module, cycle) {
  const url = (currentLinks[module] && currentLinks[module][cycle]) ? currentLinks[module][cycle] : "";
  const folderId = getFolderId(url);

  if (!url || !folderId) {
    return Swal.fire({ icon: 'info', title: 'قريباً', text: 'ملفات هذه الدورة غير متوفرة حالياً.', confirmButtonColor: '#0FBA50' });
  }

  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
  const driveBtn = SHOW_DRIVE_BUTTON ? `<div style="text-align:center; margin-top:15px;"><a href="${url}" target="_blank" style="background:#0FBA50; color:#fff; padding:10px 20px; border-radius:12px; text-decoration:none; font-weight:bold;"><i class="fa-brands fa-google-drive"></i> فتح في درايف</a></div>` : '';

  Swal.fire({
    title: `ملفات الدورة ${cycle === 1 ? 'الأولى' : cycle === 2 ? 'الثانية' : 'الثالثة'}`,
    html: `
      <div style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; height: 55vh;">
        <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;"></iframe>
      </div>
      ${driveBtn}
    `,
    width: '900px', showConfirmButton: true, confirmButtonText: 'إغلاق', showDenyButton: true, denyButtonText: 'رجوع'
  }).then((res) => { if (res.isDenied) openCourses(module); });
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