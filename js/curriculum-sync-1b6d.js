// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("ADMIN");
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
        try {
            const adminDoc = await db.collection("center_admins").doc(String(userEmpId)).get();
            if (adminDoc.exists) {
                const data = adminDoc.data();
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

// استخراج المعطيات من الرابط
const params = new URLSearchParams(window.location.search);
const cId = params.get('c');
const lvl = params.get('l');
const spc = params.get('s');

function goBack() { window.location.href = "/files-upload"; }

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
        window.location.href = "/secure-login"; 
        return; 
    }

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const hasPermission = await checkUserPermissions();
            if (hasPermission) {
                initSiteSettings();
            }
        } else {
            window.location.href = "/secure-login";
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
  const isGlobalOpen = SITE_SETTINGS.GLOBAL_CYCLE_STATUS && SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle];
  if(!isGlobalOpen) return false;
  return SITE_SETTINGS.MODULE_CYCLE_STATUS && SITE_SETTINGS.MODULE_CYCLE_STATUS[module] && SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle];
}

function getFolderId(url) {
    if (!url) return null;
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
}

function openCourses(module){
  if(!SITE_SETTINGS) return;
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

function openFileManager(module, cycle) {
  const url = (currentLinks[module] && currentLinks[module][cycle]) ? currentLinks[module][cycle] : "";
  const folderId = getFolderId(url);

  if (!url || !folderId) {
    Swal.fire('تنبيه', 'لم يقم مدير المديرية بتعيين رابط مسار (Google Drive) لهذا المقياس.', 'info');
    return;
  }

  Swal.fire({ title: 'جاري جلب الملفات...', html: '<div class="spinner"></div>', showConfirmButton: false, width: window.innerWidth < 768 ? '95%' : '850px', allowOutsideClick: false });

  fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
  .then(res => res.json())
  .then(data => {
    if(data.error) Swal.fire('خطأ', 'تأكد من رابط السكريبت وصلاحيات المجلد', 'error');
    else renderFileManager(folderId, data.files, module, cycle);
  }).catch(err => Swal.fire('خطأ في الاتصال', 'حدث خطأ في قراءة الملفات.', 'error'));
}

function renderFileManager(folderId, files, module, cycle) {
    let filesHtml = '';
    if(!files || files.length === 0) {
        filesHtml = '<div style="text-align:center; padding:30px; color:#777; font-size:16px;">المجلد فارغ حالياً</div>';
    } else {
        files.forEach(file => {
            let iconClass = 'fa-file'; 
            if(file.type.includes('pdf')) iconClass = 'fa-file-pdf';
            else if(file.type.includes('image')) iconClass = 'fa-file-image';
            else if(file.type.includes('word') || file.type.includes('doc')) iconClass = 'fa-file-word';

            filesHtml += `
            <div class="file-row">
                <a href="${file.url}" target="_blank" class="file-name-group"><i class="fa-solid ${iconClass} file-icon"></i> ${file.name}</a>
                <button class="delete-btn" onclick="deleteFile('${file.id}', '${folderId}', '${module}', ${cycle})"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>`;
        });
    }

    const htmlContent = `
    <div class="file-manager-container">
        <div class="upload-section">
            <input type="file" id="fileInput" style="display:none" onchange="document.getElementById('fileNameDisplay').innerText = this.files[0].name">
            <button class="upload-btn-real" onclick="document.getElementById('fileInput').click()" title="اختر ملفاً"><i class="fa-solid fa-folder-open"></i> <span>اختر ملف</span></button>
            <span id="fileNameDisplay">لم يتم اختيار أي ملف</span>
            <button class="upload-btn-real" style="background:#1E68E8" onclick="uploadFile('${folderId}', '${module}', ${cycle})" title="رفع الملف"><i class="fa-solid fa-cloud-arrow-up"></i> <span>بدء الرفع</span></button>
        </div>
        <div class="file-list">${filesHtml}</div>
    </div>`;

    Swal.fire({
        title: `إدارة ملفات الدورة ${cycle}`, html: htmlContent, width: window.innerWidth < 768 ? '95%' : '950px', 
        showConfirmButton: true, confirmButtonText: 'إغلاق', showDenyButton: true, denyButtonText: 'العودة للمقاييس', scrollbarPadding: false
    }).then((res) => { if(res.isDenied) openCourses(module); });
}

function deleteFile(fileId, folderId, module, cycle) {
    Swal.fire({
        title: 'هل أنت متأكد؟', text: "لا يمكن التراجع عن هذا الإجراء وسيتم حذف الملف نهائياً!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'نعم، احذفه!', cancelButtonText: 'إلغاء', width: window.innerWidth < 768 ? '95%' : '600px'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'جاري الحذف...', showConfirmButton: false, allowOutsideClick: false});
            fetch(`${APPS_SCRIPT_URL}?action=delete&fileId=${fileId}&folderId=${folderId}`, {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                if(data.status === 'success') { Swal.fire('تم!', 'تم حذف الملف بنجاح.', 'success').then(() => openFileManager(module, cycle)); }
                else { Swal.fire('خطأ', 'فشل الحذف', 'error'); }
            });
        }
    });
}

function uploadFile(folderId, module, cycle) {
    const fileInput = document.getElementById('fileInput');
    if(fileInput.files.length === 0) return Swal.showValidationMessage('الرجاء اختيار ملف أولاً قبل محاولة الرفع');

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const rawData = e.target.result.split(',')[1];
        Swal.fire({ title: 'جاري الرفع...', html: 'يرجى الانتظار، لا تقم بإغلاق النافذة <div class="spinner"></div>', showConfirmButton: false, allowOutsideClick: false, width: window.innerWidth < 768 ? '95%' : '600px' });

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('folderId', folderId);
        formData.append('data', rawData);
        formData.append('name', file.name);
        formData.append('mime', file.type);

        fetch(APPS_SCRIPT_URL, {method: 'POST', body: formData})
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') { Swal.fire('نجاح', 'تم رفع الملف بنجاح', 'success').then(() => openFileManager(module, cycle)); }
            else { Swal.fire('خطأ', 'فشل الرفع، الرجاء المحاولة مرة أخرى', 'error'); }
        })
        .catch(err => Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بالخادم', 'error'));
    };
    reader.readAsDataURL(file);
}