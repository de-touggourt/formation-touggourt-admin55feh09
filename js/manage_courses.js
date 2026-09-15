// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}
// ==================== إعدادات Firebase والاتصال اللحظي ====================
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
let currentLinks = {};

// إعدادات الجلسة والحماية
const userEmpId = sessionStorage.getItem("userEmpId");
const inspectorCenter = sessionStorage.getItem("inspectorCenter");

// ==================== فحص صلاحيات المسؤول الإداري ====================
async function checkUserPermissions() {
    if (userEmpId !== "ADMIN_ACCESS") {
        const cachedRole = sessionStorage.getItem("userJobTitle");
        if (cachedRole === "المسؤول الإداري") {
            document.body.innerHTML = ""; 
            Swal.fire({
                icon: 'error',
                title: 'صلاحيات مقيدة',
                text: 'عذراً أستاذي الكريم، إدارة ملفات المقاييس هي صلاحية حصرية للمسؤول البيداغوجي.',
                allowOutsideClick: false,
                confirmButtonText: 'العودة للوحة التحكم',
                confirmButtonColor: '#1E68E8'
            }).then(() => {
                window.location.href = (window.location.protocol === "file:") ? "inspector_dashboard.html" : "/inspector"; 
            });
            return false;
        } else if (cachedRole) {
            return true;
        }
        try {
            const adminDoc = await db.collection("center_admins").doc(String(userEmpId)).get();
            if (adminDoc.exists) {
                const data = adminDoc.data();
                sessionStorage.setItem("userJobTitle", data.jobTitle || "");
                if (data.jobTitle === "المسؤول الإداري") {
                    document.body.innerHTML = ""; 
                    Swal.fire({
                        icon: 'error',
                        title: 'صلاحيات مقيدة',
                        text: 'عذراً أستاذي الكريم، إدارة ملفات المقاييس هي صلاحية حصرية للمسؤول البيداغوجي.',
                        allowOutsideClick: false,
                        confirmButtonText: 'العودة للوحة التحكم',
                        confirmButtonColor: '#1E68E8'
                    }).then(() => {
                        window.location.href = (window.location.protocol === "file:") ? "inspector_dashboard.html" : "/inspector"; 
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

// استخراج المعطيات من الرابط
const params = new URLSearchParams(window.location.search);
const cId = params.get('c');
const lvl = params.get('l');
const spc = params.get('s');

function goBack() { 
    window.location.href = (window.location.protocol === "file:") ? "dashboard_finale_upload.html" : "/files-upload"; 
}

const textToType = "الجمهورية الجزائرية الديمقراطية الشعبية | وزارة التربية الوطنية | مديرية التربية لولاية توقرت";
const typeWriterElement = document.getElementById('typewriter-text');
let charIndex = 0;
function typeWriter() {
    if (charIndex < textToType.length) {
        typeWriterElement.innerHTML += textToType.charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, 45); 
    }
}

// دالة جلب الإعدادات اللحظية من Firestore
function initSiteSettings() {
    const docRef = db.collection("site_settings").doc("main");
    
    docRef.onSnapshot((doc) => {
        if (doc.exists) {
            SITE_SETTINGS = doc.data();
            
            if (userEmpId !== "ADMIN_ACCESS" && cId) {
                const selectedCenterName = SITE_SETTINGS.UI_NAMES.centers[cId];
                if (selectedCenterName !== inspectorCenter) {
                    document.body.innerHTML = ""; 
                    Swal.fire({
                        icon: 'error', title: 'تنبيه أمني صارم', text: 'ليس لديك صلاحية لإدارة ملفات هذا المركز!',
                        allowOutsideClick: false, confirmButtonText: 'العودة للوحة التحكم', confirmButtonColor: '#d33'
                    }).then(() => { window.location.href = "/inspector"; });
                    return;
                }
            }

            if(cId && lvl && spc) {
                const centerName = SITE_SETTINGS.UI_NAMES.centers[cId] || "غير معروف";
                document.getElementById('page-title').innerText = "مركز التكوين " + centerName;
                
                const levelName = SITE_SETTINGS.UI_NAMES.levels[lvl] || lvl;
                const specName = SITE_SETTINGS.UI_NAMES.specs[spc] || spc;
                
                document.getElementById('page-subtitle').innerText = "إدارة ملفات: " + levelName + " - " + specName;
                
                if(SITE_SETTINGS.UI_NAMES.centerLogos && SITE_SETTINGS.UI_NAMES.centerLogos[cId]) {
                    const logoImg = document.getElementById('center-logo');
                    if(logoImg) logoImg.src = SITE_SETTINGS.UI_NAMES.centerLogos[cId];
                }

                if(SITE_SETTINGS.dbLinks[cId] && SITE_SETTINGS.dbLinks[cId][lvl] && SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
                    currentLinks = SITE_SETTINGS.dbLinks[cId][lvl][spc];
                }
            }
        } else {
            Swal.fire('خطأ', 'لم يتم العثور على إعدادات الموقع المركزية في قاعدة البيانات.', 'error');
        }
    });
}

window.onload = async function() { 
    typeWriter(); 
    
    // التحقق من وجود الجلسة وسيرفرات فايربيز
    const userEmpId = sessionStorage.getItem("userEmpId");
    if (!userEmpId) { 
        window.location.href = (window.location.protocol === "file:") ? "admin095526.html" : "/secure-login"; 
        return; 
    }

    // بدء التحميل الفوري دون انتظار تسلسلي بطيء
    const hasPermission = await checkUserPermissions();
    if (hasPermission) {
        initSiteSettings();
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user && !sessionStorage.getItem("userEmpId")) {
            window.location.href = (window.location.protocol === "file:") ? "admin095526.html" : "/secure-login";
        }
    });
};

// ==================== الفيديوهات المرفقة ====================
function syncVideoInputs() {
    if (!currentLinks['videos']) return;
    let videos = currentLinks['videos'];
    videos.forEach((vid, i) => {
        let titleEl = document.getElementById(`vid_title_${i}`);
        let urlEl = document.getElementById(`vid_url_${i}`);
        if (titleEl) vid.title = titleEl.value;
        if (urlEl) vid.url = urlEl.value;
    });
}

window.addVideoField = function() {
    syncVideoInputs();
    if (!currentLinks['videos']) currentLinks['videos'] = [];
    currentLinks['videos'].push({ title: "الدرس: ", url: "" });
    openVideos(); 
}

window.removeVideoField = function(index) {
    syncVideoInputs();
    let vid = currentLinks['videos'][index];
    
    if (!vid.url && (!vid.title || vid.title === "الدرس: ")) {
        currentLinks['videos'].splice(index, 1);
        openVideos();
        return;
    }

    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا الفيديو من القائمة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#94a3b8',
        confirmButtonText: 'نعم، احذف العنصر',
        cancelButtonText: 'تراجع'
    }).then((result) => {
        if (result.isConfirmed) {
            currentLinks['videos'].splice(index, 1);
            openVideos();
        }
    });
}

window.saveVideosToFirebase = async function() {
    syncVideoInputs();
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        SITE_SETTINGS.dbLinks[cId][lvl][spc]['videos'] = currentLinks['videos'];
        await db.collection("site_settings").doc("main").set(SITE_SETTINGS);
        
        Swal.fire({ 
            icon: 'success', 
            title: 'تم الحفظ بنجاح', 
            text: 'تم تحديث قائمة الفيديوهات واعتمادها للطلبة.', 
            timer: 2000, 
            showConfirmButton: false 
        });
    } catch (error) {
        console.error("خطأ في حفظ الفيديوهات:", error);
        Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بقاعدة البيانات، لم يتم الحفظ.', 'error');
    }
}

window.openVideos = function() {
    if(!SITE_SETTINGS) return;
    if (!currentLinks['videos']) currentLinks['videos'] = [];
    let videos = currentLinks['videos'];
    
    let customCSS = `
        <style>
            .vid-modal-body { text-align: right; direction: rtl; font-family: 'Cairo', sans-serif; padding: 10px; }
            .vid-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-bottom: 20px; position: relative; border-right: 6px solid #1E68E8; box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
            .vid-grid { display: flex; flex-direction: column; gap: 20px; }
            @media (min-width: 800px) {
                .vid-grid { flex-direction: row; align-items: flex-start; }
                .vid-input-group-title { flex: 1.2; }
                .vid-input-group-url { flex: 2.8; }
            }
            .vid-input-group label { display: block; font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
            .vid-input { width: 100%; padding: 14px 18px; border: 2px solid #cbd5e1; border-radius: 10px; font-family: 'Cairo'; font-size: 15px; outline: none; transition: 0.3s; background: #f8fafc; color: #0f172a; font-weight: 600; box-sizing: border-box; }
            .vid-input:focus { border-color: #1E68E8; background: #ffffff; box-shadow: 0 0 0 4px rgba(30,104,232,0.15); }
            .vid-actions { display: flex; gap: 15px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 2px dashed #e2e8f0; }
            .btn-v { padding: 10px 22px; border-radius: 10px; font-family: 'Cairo'; font-weight: bold; font-size: 15px; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; text-decoration: none; }
            .btn-v-watch { background: #e0f2fe; color: #0284c7; }
            .btn-v-watch:hover { background: #bae6fd; color: #0369a1; transform: translateY(-2px); }
            .btn-v-delete { background: #fee2e2; color: #dc2626; }
            .btn-v-delete:hover { background: #fecaca; color: #b91c1c; transform: translateY(-2px); }
            .btn-v-add { width: 100%; background: #f0fdf4; color: #16a34a; border: 3px dashed #bbf7d0; padding: 20px; justify-content: center; font-size: 18px; margin-bottom: 25px; transition: 0.3s; border-radius: 12px; }
            .btn-v-add:hover { background: #dcfce7; border-color: #86efac; transform: translateY(-3px); box-shadow: 0 5px 15px rgba(22,163,74,0.1); }
            .btn-v-save { background: #1E68E8; color: white; padding: 16px 45px; font-size: 18px; justify-content: center; box-shadow: 0 5px 15px rgba(30,104,232,0.3); border-radius: 40px; transition: 0.3s; }
            .btn-v-save:hover { background: #1557c0; transform: translateY(-3px); box-shadow: 0 8px 20px rgba(30,104,232,0.4); }
            .swal-modal-custom-wide { max-width: 1100px !important; padding: 30px 10px !important; }
        </style>
    `;
    
    let html = customCSS + '<div class="vid-modal-body"><div style="max-height: 65vh; overflow-y: auto; padding-left: 10px; padding-right: 5px; margin-bottom: 20px;">';
    
    if (videos.length === 0) {
        html += `
        <div style="text-align:center; padding:60px 20px; color:#94a3b8; border:3px dashed #cbd5e1; border-radius:15px; background:#f8fafc; margin-bottom: 20px;">
            <div style="width: 90px; height: 90px; background: #e2e8f0; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px auto;">
                <i class="fa-solid fa-video-slash" style="font-size:40px; color:#94a3b8;"></i>
            </div>
            <span style="font-size:22px; font-weight:900; color: #334e68; display:block; margin-bottom:10px;">لا توجد فيديوهات مرفقة حالياً</span>
            <span style="font-size:16px; color: #627d98;">اضغط على زر (أضف حقل فيديو جديد) بالأسفل للبدء في إدراج الروابط التعليمية.</span>
        </div>`;
    } else {
        videos.forEach((vid, index) => {
            let watchBtn = vid.url 
                ? `<a href="${vid.url}" target="_blank" class="btn-v btn-v-watch" title="انقر لتجربة رابط الفيديو"><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الرابط للتجربة</a>` 
                : `<button class="btn-v" style="background:#f1f5f9; color:#94a3b8; cursor:not-allowed;" title="يرجى إدخال الرابط أولاً"><i class="fa-solid fa-arrow-up-right-from-square"></i> فتح الرابط للتجربة</button>`;

            html += `
            <div class="vid-card">
                <div class="vid-grid">
                    <div class="vid-input-group-title">
                        <label><i class="fa-solid fa-heading" style="color:#1E68E8; margin-left:8px; font-size:18px;"></i> عنوان الدرس أو الفيديو:</label>
                        <input type="text" id="vid_title_${index}" class="vid-input" value="${vid.title || ''}" placeholder="اكتب العنوان هنا (مثال: الدرس الأول)...">
                    </div>
                    
                    <div class="vid-input-group-url">
                        <label><i class="fa-solid fa-link" style="color:#1E68E8; margin-left:8px; font-size:18px;"></i> رابط الفيديو (Youtube / Google Drive):</label>
                        <input type="text" id="vid_url_${index}" class="vid-input" value="${vid.url || ''}" placeholder="https://..." dir="ltr" style="text-align:left;">
                    </div>
                </div>
                
                <div class="vid-actions">
                    ${watchBtn}
                    <button onclick="removeVideoField(${index})" class="btn-v btn-v-delete" title="حذف هذا الحقل بشكل نهائي"><i class="fa-solid fa-trash-can"></i> حذف العنصر</button>
                </div>
            </div>`;
        });
    }
    
    html += `</div>`;
    html += `<button onclick="addVideoField()" class="btn-v btn-v-add"><i class="fa-solid fa-plus-circle" style="font-size:22px;"></i> أضف حقل فيديو جديد للقائمة</button>`;
    html += `<div style="display:flex; justify-content:center; border-top: 2px solid #e2e8f0; padding-top: 25px;"><button onclick="saveVideosToFirebase()" class="btn-v btn-v-save"><i class="fa-solid fa-floppy-disk" style="font-size:20px;"></i> حفظ واعتماد التعديلات</button></div></div>`;

    Swal.fire({
        title: '<div style="font-family: Cairo; font-weight: 900; color: #0f172a; font-size: 26px;"><i class="fa-solid fa-clapperboard" style="color:#dc2626; margin-left: 10px;"></i> إدارة المحتوى المرئي</div>',
        html: html, 
        showConfirmButton: false,
        showCloseButton: true,
        width: '1100px',
        customClass: { popup: 'swal2-popup swal-modal-custom-wide' }, 
        background: '#f1f5f9' 
    });
}

// ==================== دوال فتح الدورات وإدارة الملفات ====================
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_eNgM1R-fILJq00iye9-3eeFCFjKBkMcej4VOq53gG5gshOsulAH7b-X0_JkHHrkyJw/exec"; 

function isCycleOpen(module, cycle) {
  if(!SITE_SETTINGS) return false;
  const isGlobalOpen = SITE_SETTINGS.GLOBAL_CYCLE_STATUS 
    ? ((typeof SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] !== 'undefined') ? SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] : SITE_SETTINGS.GLOBAL_CYCLE_STATUS[String(cycle)])
    : true;
  if(isGlobalOpen === false) return false;
  if(SITE_SETTINGS.MODULE_CYCLE_STATUS && SITE_SETTINGS.MODULE_CYCLE_STATUS[module]) {
    const mStatus = (typeof SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle] !== 'undefined')
      ? SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle]
      : SITE_SETTINGS.MODULE_CYCLE_STATUS[module][String(cycle)];
    if (typeof mStatus !== 'undefined') {
      return !!mStatus;
    }
  }
  return !!isGlobalOpen;
}

function getFolderId(url) {
    if (!url) return null;
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function openCourses(module){
  if(!SITE_SETTINGS) return;
  // بدء الجلب المسبق لملفات الدورات في الخلفية لتكون جاهزة فور النقر
  prefetchCycleFiles(module);

  let html='<div class="cycles-container">';
  for(let i=1;i<=3;i++){
    const open = isCycleOpen(module,i);
    html+=`
      <div class="cycle-btn ${open?'':'closed'}" onclick="${open?`openFileManager('${module}',${i})`:''}">
        <i class="fa-solid ${open?'fa-folder-open':'fa-folder-closed'}"></i>
        الدورة ${i===1?'الأولى':i===2?'الثانية':'الثالثة'}
        <span class="badge ${open?'open':'closed'}">${open?'مفتوحة':'مغلقة'}</span>
      </div>`;
  }
  html+='</div>';

  Swal.fire({ title: 'اختر الدورة للإدارة', html: html, showConfirmButton: true, confirmButtonText: 'إغلاق', width: window.innerWidth < 768 ? '95%' : '850px' });
}

// دالة الجلب المسبق الذكي لملفات الدورات لفتحها في 0 ثانية
function prefetchCycleFiles(module) {
    if (!currentLinks || !currentLinks[module]) return;
    for (let i = 1; i <= 3; i++) {
        const url = currentLinks[module][i];
        const folderId = getFolderId(url);
        if (folderId) {
            const cacheKey = `files_data_${folderId}`;
            if (!localStorage.getItem(cacheKey) && !sessionStorage.getItem(cacheKey)) {
                fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
                    .then(r => r.json())
                    .then(d => {
                        if (!d.error) {
                            const filesList = Array.isArray(d) ? d : (Array.isArray(d?.files) ? d.files : []);
                            localStorage.setItem(cacheKey, JSON.stringify(filesList));
                            sessionStorage.setItem(cacheKey, JSON.stringify(filesList));
                            sessionStorage.setItem(`files_count_${folderId}`, filesList.length);
                        }
                    }).catch(() => {});
            }
        }
    }
}

function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes) || bytes === 0) return '';
    const k = 1024;
    const sizes = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + (sizes[i] || 'م.ب');
}

function getFileTypeMeta(file) {
    const name = (file.name || '').toLowerCase();
    const ext = (name.split('.').pop() || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    
    if (ext === 'pdf' || mime.includes('pdf')) {
        return { icon: 'fa-file-pdf', css: 'file-icon-pdf', label: 'PDF' };
    }
    if (['doc', 'docx'].includes(ext) || mime.includes('word') || mime.includes('officedocument.wordprocessing')) {
        return { icon: 'fa-file-word', css: 'file-icon-word', label: 'Word' };
    }
    if (['xls', 'xlsx'].includes(ext) || mime.includes('excel') || mime.includes('spreadsheet')) {
        return { icon: 'fa-file-excel', css: 'file-icon-excel', label: 'Excel' };
    }
    if (['ppt', 'pptx'].includes(ext) || mime.includes('powerpoint') || mime.includes('presentation')) {
        return { icon: 'fa-file-powerpoint', css: 'file-icon-ppt', label: 'PowerPoint' };
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mime.includes('image')) {
        return { icon: 'fa-file-image', css: 'file-icon-image', label: 'صورة' };
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mime.includes('zip') || mime.includes('rar')) {
        return { icon: 'fa-file-zipper', css: 'file-icon-archive', label: 'أرشيف' };
    }
    if (['mp4', 'mkv', 'avi', 'webm'].includes(ext) || mime.includes('video')) {
        return { icon: 'fa-file-video', css: 'file-icon-ppt', label: 'فيديو' };
    }
    return { icon: 'fa-file-lines', css: 'file-icon-default', label: 'ملف' };
}

window.handleFileManagerFileSelect = function(input) {
    const display = document.getElementById('fileNameDisplay');
    const uploadBtn = document.getElementById('startUploadBtn');
    if (input.files && input.files[0]) {
        const f = input.files[0];
        const sizeStr = formatFileSize(f.size);
        if (display) {
            display.innerHTML = `<i class="fa-solid fa-file-circle-check" style="color:#16a34a; margin-left:6px;"></i> <span style="color:#0f172a; font-weight:700;">${f.name}</span> <span style="color:#64748b; font-size:11px;">(${sizeStr})</span>`;
            display.style.background = '#f0fdf4';
            display.style.borderColor = '#86efac';
        }
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
    } else {
        if (display) {
            display.innerHTML = `<i class="fa-solid fa-circle-info" style="margin-left:5px;"></i> لم يتم اختيار أي ملف`;
            display.style.background = '#f8fafc';
            display.style.borderColor = '#cbd5e1';
        }
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.style.opacity = '0.6';
            uploadBtn.style.cursor = 'not-allowed';
        }
    }
};

window.filterManagerFiles = function(query) {
    const q = (query || '').trim().toLowerCase();
    const cards = document.querySelectorAll('.fm-file-card');
    let visibleCount = 0;
    cards.forEach(card => {
        const name = card.getAttribute('data-filename') || '';
        const type = card.getAttribute('data-filetype') || '';
        if (!q || name.includes(q) || type.includes(q)) {
            card.style.display = 'flex';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    const countBadge = document.getElementById('fmFilesCountBadge');
    if (countBadge) {
        if (q) {
            countBadge.innerHTML = `<i class="fa-solid fa-filter" style="margin-left:5px;"></i>${visibleCount} من ${cards.length} ملف`;
        } else {
            countBadge.innerHTML = `<i class="fa-solid fa-layer-group" style="margin-left:5px;"></i>${cards.length} ملف`;
        }
    }
};

// توليد بطاقات الملفات بحجم وهيئة بطاقات صفحة المتكونين تماماً
function generateFilesGridHtml(files, folderId, module, cycle) {
    if (!files || files.length === 0) {
        return `
        <div style="grid-column: 1 / -1; text-align:center; padding:35px 20px; color:#64748b; border:2px dashed #cbd5e1; border-radius:16px; background:#fff;">
            <i class="fa-regular fa-folder-open" style="font-size:42px; color:#cbd5e1; margin-bottom:10px; display:block;"></i>
            <div style="font-size:15px; font-weight:700; color:#475569; margin-bottom:4px;">المجلد فارغ حالياً</div>
            <div style="font-size:12.5px; color:#94a3b8;">يمكنك البدء برفع مذكرات وملفات هذا المقياس عبر لوحة الرفع أعلاه</div>
        </div>`;
    }

    return files.map(file => {
        const meta = getFileTypeMeta(file);
        const sizeStr = file.size ? formatFileSize(file.size) : '';
        const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;

        return `
        <div class="fm-file-card" data-filename="${(file.name || '').toLowerCase()}" data-filetype="${meta.label.toLowerCase()}">
            <div class="fm-file-top">
                <div class="fm-file-icon-box ${meta.css}">
                    <i class="fa-solid ${meta.icon}"></i>
                </div>
                <div class="fm-file-info">
                    <div class="fm-file-title" title="${file.name || ''}">${file.name || 'ملف بدون اسم'}</div>
                    <div class="fm-file-meta">
                        <span class="file-ext-tag">${meta.label}</span>
                        ${sizeStr ? `<span><i class="fa-solid fa-hard-drive" style="margin-left:3px; font-size:10px;"></i>${sizeStr}</span>` : '<span><i class="fa-solid fa-cloud-arrow-down"></i> جاهز للتحميل</span>'}
                    </div>
                </div>
            </div>
            <div class="fm-file-actions">
                <a href="${previewUrl}" target="_blank" class="btn-fm-act btn-fm-preview" title="معاينة الملف">
                    <i class="fa-solid fa-eye"></i> معاينة
                </a>
                <a href="${downloadUrl}" target="_blank" download class="btn-fm-act btn-fm-download" title="تحميل الملف">
                    <i class="fa-solid fa-download"></i> تحميل
                </a>
                <button type="button" class="btn-fm-act btn-fm-delete" onclick="deleteFile('${file.id}', '${folderId}', '${module}', ${cycle})" title="حذف الملف نهائياً">
                    <i class="fa-solid fa-trash-can"></i> حذف
                </button>
            </div>
        </div>`;
    }).join('');
}

function openFileManager(module, cycle) {
  const url = (currentLinks[module] && currentLinks[module][cycle]) ? currentLinks[module][cycle] : "";
  const folderId = getFolderId(url);

  if (!url || !folderId) {
    Swal.fire('تنبيه', 'لم يقم مدير المديرية بتعيين رابط مسار (Google Drive) لهذا المقياس.', 'info');
    return;
  }

  const cacheKey = `files_data_${folderId}`;
  // 1. فحص الكاش الفوري (localStorage أولاً لفتح النافذة في 0 ثانية)
  let cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
  if (cached) {
    try {
      const cachedFiles = JSON.parse(cached);
      renderFileManager(folderId, cachedFiles, module, cycle);

      // تحديث صامت في الخلفية لجلب أي ملفات جديدة أو محذوفة بدون تعطيل المستخدم
      fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
        .then(r => r.json())
        .then(d => {
          if (!d.error) {
            const filesList = Array.isArray(d) ? d : (Array.isArray(d?.files) ? d.files : []);
            localStorage.setItem(cacheKey, JSON.stringify(filesList));
            sessionStorage.setItem(cacheKey, JSON.stringify(filesList));
            sessionStorage.setItem(`files_count_${folderId}`, filesList.length);
            
            // تحديث البطاقات بسلاسة إذا كانت النافذة لا تزال مفتوحة لذات المجلد
            const grid = document.getElementById('fmFilesGrid');
            if (grid && grid.getAttribute('data-folder-id') === folderId) {
                grid.innerHTML = generateFilesGridHtml(filesList, folderId, module, cycle);
                const countBadge = document.getElementById('fmFilesCountBadge');
                if (countBadge) countBadge.innerHTML = `<i class="fa-solid fa-layer-group" style="margin-left:5px;"></i>${filesList.length} ملف`;
            }
          }
        }).catch(() => {});
      return;
    } catch(e) {}
  }

  // 2. إذا لم يتوفر كاش سابق، نعرض مؤشر تحميل خفيف وسريع
  Swal.fire({
    title: 'جاري جلب الملفات...',
    html: `
      <div style="padding: 25px; text-align:center;">
        <div class="spinner" style="margin: 0 auto 12px auto; width:45px; height:45px;"></div>
        <p style="color:#1E68E8; font-weight:700; font-size:14px; margin:0;">جاري تحميل الملفات من Google Drive...</p>
      </div>
    `,
    showConfirmButton: false,
    width: '400px',
    allowOutsideClick: false
  });

  fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
  .then(res => res.json())
  .then(data => {
    if(data.error) {
        Swal.fire('خطأ', 'تأكد من رابط السكريبت وصلاحيات المجلد على Google Drive.', 'error');
    } else {
      const filesList = Array.isArray(data) ? data : (Array.isArray(data?.files) ? data.files : []);
      localStorage.setItem(cacheKey, JSON.stringify(filesList));
      sessionStorage.setItem(cacheKey, JSON.stringify(filesList));
      sessionStorage.setItem(`files_count_${folderId}`, filesList.length);
      renderFileManager(folderId, filesList, module, cycle);
    }
  }).catch(err => Swal.fire('خطأ في الاتصال', 'حدث خطأ في قراءة الملفات من السحابة.', 'error'));
}

function renderFileManager(folderId, files, module, cycle) {
    const filesList = Array.isArray(files) ? files : [];
    const cycleTitles = { 1: "الدورة الأولى", 2: "الدورة الثانية", 3: "الدورة الثالثة" };
    const cycleTitle = cycleTitles[cycle] || `الدورة ${cycle}`;
    const moduleName = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.modules && SITE_SETTINGS.UI_NAMES.modules[module]) ? SITE_SETTINGS.UI_NAMES.modules[module] : module;

    const htmlContent = `
    <div class="file-manager-container">
        <!-- شريط الرأس والبحث -->
        <div class="fm-header-bar">
            <div class="fm-search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="fmSearchInput" placeholder="🔍 بحث سريع بالاسم أو النوع..." oninput="window.filterManagerFiles(this.value)">
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span id="fmFilesCountBadge" style="background:#e0f2fe; color:#0369a1; padding:5px 12px; border-radius:20px; font-weight:700; font-size:12px;">
                    <i class="fa-solid fa-layer-group" style="margin-left:4px;"></i>${filesList.length} ملف
                </span>
                <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" style="background:#f1f5f9; color:#475569; padding:5px 12px; border-radius:20px; font-weight:700; font-size:12px; text-decoration:none; display:inline-flex; align-items:center; gap:5px; transition:0.2s;">
                    <i class="fa-brands fa-google-drive" style="color:#22c55e;"></i> فتح المجلد في Drive
                </a>
            </div>
        </div>

        <!-- لوحة الرفع السريعة المدمجة -->
        <div class="fm-upload-panel">
            <input type="file" id="fileInput" style="display:none" onchange="window.handleFileManagerFileSelect(this)">
            <div class="fm-upload-controls">
                <button type="button" class="upload-btn-real" onclick="document.getElementById('fileInput').click()">
                    <i class="fa-solid fa-folder-open"></i> <span>اختر ملفاً للرفع</span>
                </button>
                <div id="fileNameDisplay" style="font-size:12px; font-weight:600; color:#64748b; background:#f8fafc; padding:6px 12px; border-radius:8px; border:1px dashed #cbd5e1; max-width:340px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <i class="fa-solid fa-circle-info" style="margin-left:4px;"></i> لم يتم اختيار أي ملف
                </div>
            </div>
            <button type="button" id="startUploadBtn" class="upload-btn-real" style="background:#16a34a; opacity:0.6; cursor:not-allowed;" disabled onclick="uploadFile('${folderId}', '${module}', ${cycle})">
                <i class="fa-solid fa-cloud-arrow-up"></i> <span>بدء الرفع</span>
            </button>
        </div>

        <!-- شبكة عرض الملفات المتناسقة مع صفحة المتكونين -->
        <div class="fm-files-grid" id="fmFilesGrid" data-folder-id="${folderId}">
            ${generateFilesGridHtml(filesList, folderId, module, cycle)}
        </div>
    </div>`;

    Swal.fire({
        title: `<div style="display:flex; align-items:center; gap:10px; font-size:1.25rem; color:#0f172a;"><i class="fa-solid fa-folder-tree" style="color:#1E68E8;"></i> إدارة ملفات: ${moduleName} - <span style="color:#1E68E8;">${cycleTitle}</span></div>`,
        html: htmlContent,
        width: '920px',
        customClass: { popup: 'swal2-popup swal-fullscreen-filemanager' },
        showConfirmButton: true,
        confirmButtonText: 'إغلاق النافذة',
        showDenyButton: true,
        denyButtonText: '<i class="fa-solid fa-arrow-right"></i> قائمة الدورات',
        denyButtonColor: '#64748b',
        scrollbarPadding: false
    }).then((res) => {
        if (res.isDenied) openCourses(module);
    });
}

function deleteFile(fileId, folderId, module, cycle) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا الملف نهائياً من السحابة؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف الملف',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'جاري الحذف...',
                html: 'يرجى الانتظار لحذف الملف من سحابة Google Drive <div class="spinner"></div>',
                showConfirmButton: false,
                allowOutsideClick: false,
                width: '400px'
            });
            fetch(`${APPS_SCRIPT_URL}?action=delete&fileId=${fileId}&folderId=${folderId}`, {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') { 
                    localStorage.removeItem(`files_data_${folderId}`);
                    localStorage.removeItem(`files_count_${folderId}`);
                    sessionStorage.removeItem(`files_data_${folderId}`);
                    sessionStorage.removeItem(`files_count_${folderId}`);
                    Swal.fire({
                        icon: 'success',
                        title: 'تم الحذف بنجاح',
                        text: 'تمت إزالة الملف من المجلد السحابي.',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => openFileManager(module, cycle)); 
                }
                else { Swal.fire('خطأ', 'فشل حذف الملف من السحابة', 'error'); }
            })
            .catch(err => Swal.fire('خطأ في الاتصال', 'حدث خطأ أثناء محاولة الحذف.', 'error'));
        }
    });
}

function uploadFile(folderId, module, cycle) {
    const fileInput = document.getElementById('fileInput');
    if(!fileInput || fileInput.files.length === 0) {
        Swal.fire('تنبيه', 'الرجاء اختيار ملف أولاً قبل محاولة الرفع', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const rawData = e.target.result.split(',')[1];
        Swal.fire({
            title: 'جاري الرفع إلى السحابة...',
            html: `يرجى الانتظار أثناء رفع <b>${file.name}</b> إلى Google Drive <div class="spinner"></div>`,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: '400px'
        });

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('folderId', folderId);
        formData.append('data', rawData);
        formData.append('name', file.name);
        formData.append('mime', file.type);

        fetch(APPS_SCRIPT_URL, {method: 'POST', body: formData})
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') { 
                localStorage.removeItem(`files_data_${folderId}`);
                localStorage.removeItem(`files_count_${folderId}`);
                sessionStorage.removeItem(`files_data_${folderId}`);
                sessionStorage.removeItem(`files_count_${folderId}`);
                Swal.fire({
                    icon: 'success',
                    title: 'تم الرفع بنجاح',
                    text: `تم رفع الملف ${file.name} وإضافته إلى الدورة بنجاح.`,
                    timer: 1800,
                    showConfirmButton: false
                }).then(() => openFileManager(module, cycle)); 
            }
            else { Swal.fire('خطأ', data.message || 'فشل الرفع، الرجاء المحاولة مرة أخرى', 'error'); }
        })
        .catch(err => Swal.fire('خطأ في الاتصال', 'حدث خطأ أثناء الاتصال بالخادم السحابي', 'error'));
    };
    reader.readAsDataURL(file);
}