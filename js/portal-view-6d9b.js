// ================= إعدادات Firebase =================
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

// ==========================================
// المتغيرات العامة وبيانات المستخدم
// ==========================================
let loggedInUser = null;
let userDocId = null;
let SITE_SETTINGS = null;
const PHOTO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSe-P_rRLZ0iiQtC1oB9mAkaNJ3b1r0pUsWpQgPznW4k5mItoMxlPjROd9wpev6rUjBw/exec";

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

// ==========================================
// 🔡 كود الكتابة السلسة
// ==========================================
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

// دالة مساعدة لتنقية المعرف
function extractCoreId(val) {
    if (!val) return "";
    let str = String(val).trim().toUpperCase();
    let digitsOnly = str.replace(/\D/g, "");
    let core = digitsOnly.replace(/^0+/, ""); 
    return core === "" ? digitsOnly : core;
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

// ================= دالة جلب الصورة من درايف (فائقة السرعة ومحصنة ضد أخطاء الكاش) =================
async function fetchPhotosFromDrive(coreId, avatarBox) {
    try {
        // 🌟 استخدام كاسر الكاش لمنع خطأ CORS على F5 🌟
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

                // 🌟 استخدام سيرفر lh3 الفائق مع توفير رابط بديل 🌟
                if (match) {
                    lh3Url = `https://lh3.googleusercontent.com/d/${match[1]}=s800`;
                    thumbUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
                }

                // حفظ الصورة في التخزين المحلي للمتصفح لتظهر في المرة القادمة في 0 ثانية
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

// ==========================================
// 🔒 التحقق الأمني وجلب بيانات المتكون عند الدخول
// ==========================================
window.onload = async function() {
    if (window.SecurityGuard && !SecurityGuard.verifySession()) return;
    typeWriter();
    
    const empId = sessionStorage.getItem("userEmpId");
    if(!empId) {
        document.getElementById("loader").style.display = "none";
        window.location.href = "/login"; 
        return;
    }

    if(empId === "ADMIN_ACCESS") {
        document.getElementById("loader").style.display = "none";
        loggedInUser = { center: "ADMIN" }; 
        
        document.getElementById('userNameDisplay').innerText = 'مدير النظام';
        document.getElementById('userRankDisplay').innerText = 'حساب الإدارة المركزية';
        // 🌟 عرض التخصص للمدير 🌟
        if(document.getElementById('userSpecDisplay')) {
            document.getElementById('userSpecDisplay').innerText = 'إدارة شاملة'; 
        }
        document.getElementById('userWorkplaceDisplay').innerText = 'مديرية التربية لولاية توقرت';
        
        initSiteSettings(); 
        return;
    }

    try {
        const docRef = db.collection("employeescomnew").doc(empId);
        const docSnap = await docRef.get();
        
        if(docSnap.exists) {
            loggedInUser = docSnap.data();
            userDocId = docSnap.id;
        } else {
            let querySnapshot = await db.collection("employeescomnew").where("id", "==", empId).get();
            if(!querySnapshot.empty) {
                loggedInUser = querySnapshot.docs[0].data();
                userDocId = querySnapshot.docs[0].id;
            }
        }

        if(!loggedInUser) {
            document.getElementById("loader").style.display = "none";
            Swal.fire('خطأ', 'لم يتم العثور على بياناتك، يرجى مراجعة الإدارة.', 'error')
            .then(() => { sessionStorage.clear(); window.location.href="/login"; });
            return;
        }

        // 🌟 إخفاء شاشة التحميل هنا فور جلب بيانات المتكون بنجاح 🌟
        document.getElementById("loader").style.display = "none";
        
        document.getElementById('userNameDisplay').innerText = loggedInUser.name || 'مستخدم مجهول';
        document.getElementById('userRankDisplay').innerText = loggedInUser.grade || loggedInUser.rank || 'رتبة غير محددة';
        // 🌟 عرض التخصص للمتكون 🌟
        if(document.getElementById('userSpecDisplay')) {
            document.getElementById('userSpecDisplay').innerText = loggedInUser.maty || loggedInUser.specialty || 'تخصص غير محدد';
        }
        document.getElementById('userWorkplaceDisplay').innerText = loggedInUser.place || loggedInUser.workplace || 'مكان العمل غير محدد';

                const avatarBox = document.getElementById('userAvatarContainer');
        const coreId = extractCoreId(empId);

        // 🌟 1. عرض الصورة فوراً من الكاش المحلي في 0 جزء من الثانية 🌟
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

        checkAndFillMissingInfo();
        initSiteSettings(); 

    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById("loader").style.display = "none";
        Swal.fire('خطأ في الاتصال', 'تعذر الاتصال بقاعدة البيانات. تأكد من جودة الإنترنت.', 'error');
    }
};

// ==========================================
// دالة جلب الإعدادات من Firestore وإيقاف الدوران فوراً
// ==========================================
// دالة جلب الإعدادات اللحظية (تعمل بصمت في الخلفية دون إزعاج المستخدم)
function initSiteSettings() {
    db.collection("site_settings").doc("main").onSnapshot((doc) => {
        // إخفاء الـ Loader فوراً فور وصول البيانات
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "none";

        if (doc.exists) {
            SITE_SETTINGS = doc.data();
            renderCenters(); 
        } else {
            const container = document.getElementById("centers-container");
            if (container) {
                container.innerHTML = '<div style="grid-column: 1/-1; color: #dc2626; font-weight: bold; font-size: 18px; text-align:center;">لم يتم العثور على إعدادات الموقع المركزية في قاعدة البيانات.</div>';
            }
        }
    }, (error) => {
        // 🌟 قمنا بإلغاء إظهار نافذة الخطأ (Swal.fire) هنا نهائياً 🌟
        // لأن النظام يعمل بالبيانات المخزنة مؤقتاً ولنزع الإزعاج عن المتكون
        console.warn("التحديث اللحظي تأخر قليلاً، سيتم الاعتماد على النسخة المخزنة مؤقتاً:", error);
        
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "none";
    });
}

// ==========================================
// منع إدخال غير الحروف العربية في حقل مكان الميلاد
// ==========================================
function forceArabicText(inputElement) {
    inputElement.value = inputElement.value.replace(/[^\u0600-\u06FF\s]/g, '');
}

// ==========================================================================
// 📝 نافذة إكمال المعلومات (نظام فحص ذكي للبيانات الناقصة)
// ==========================================================================
function checkAndFillMissingInfo() {
    let isDataMissing = false;

    // 1. فحص مكان الميلاد
    if (!loggedInUser.pob || loggedInUser.pob.trim() === "" || loggedInUser.pob === "-") {
        isDataMissing = true;
    }
    
    // 2. فحص دائرة الإقامة
    if (!loggedInUser.daira || loggedInUser.daira.trim() === "" || loggedInUser.daira === "-") {
        isDataMissing = true;
    }
    
    // 3. فحص العنوان
    if (!loggedInUser.adrs || loggedInUser.adrs.trim() === "" || loggedInUser.adrs === "-") {
        isDataMissing = true;
    }
    
    // 4. فحص رقم الهاتف
    if (!loggedInUser.phone || loggedInUser.phone.trim() === "" || loggedInUser.phone === "-") {
        isDataMissing = true;
    }

    // إذا كان هناك أي بيان ناقص، أظهر النافذة الإجبارية
    if (isDataMissing) {
        showCompletionForm();
    }
}

function showCompletionForm() {
    const prevPob = (loggedInUser.pob && loggedInUser.pob !== '-') ? loggedInUser.pob : '';
    const prevAdrs = (loggedInUser.adrs && loggedInUser.adrs !== '-') ? loggedInUser.adrs : '';
    const prevPhone = (loggedInUser.phone && loggedInUser.phone !== '-') ? formatPhoneString(loggedInUser.phone) : '';
    const prevDaira = (loggedInUser.daira && loggedInUser.daira !== '-') ? loggedInUser.daira : '';

    Swal.fire({
        title: 'أهلاً بك.. تحديث أمني للمعلومات',
        html: `
            <div style="text-align:right; font-size:14px; direction:rtl;">
                <p style="color: #dc3545; font-weight: bold; font-size: 13px; text-align:center;">⚠️ يرجى إكمال هذه المعلومات بدقة (لمرة واحدة فقط) لتفعيل حسابك بالكامل.</p>
                
                <div style="background: #e8fbf0; padding: 10px; border-radius: 8px; border: 1px solid #0FBA50; margin-bottom: 15px; line-height:1.7;">
                    <b>الاسم واللقب:</b> ${loggedInUser.name || '-'} <br>
                    <b>الرتبة:</b> ${loggedInUser.grade || loggedInUser.rank || '-'} <br>
                    <b>مادة التخصص:</b> ${loggedInUser.maty || loggedInUser.specialty || '-'} <br>
                    <b>مركز التكوين:</b> <span style="color:#0FBA50; font-weight:bold;">${loggedInUser.center || 'لم يحدد لك مركز بعد'}</span>
                </div>

                <label style="font-weight:bold; color:#333; font-size:13px;">مكان الميلاد (حروف عربية فقط): <span style="color:red">*</span></label>
                <input type="text" id="setup-pob" class="swal2-input" value="${prevPob}" style="margin: 5px 0 15px 0; width: 100%; height: 40px; font-size:14px; font-family: 'Cairo', sans-serif; text-align: center;" placeholder="أدخل مكان الميلاد باللغة العربية" oninput="forceArabicText(this)">
                
                <label style="font-weight:bold; color:#333; font-size:13px;">دائرة الإقامة: <span style="color:red">*</span></label>
                <select id="setup-daira" class="swal2-select" style="margin: 5px 0 15px 0; width: 100%; height: 40px; font-size:14px; padding: 0 10px; font-family: 'Cairo', sans-serif; text-align: center;">
                    <option value="">-- اختر الدائرة --</option>
                    <option value="توقرت" ${prevDaira === 'توقرت' ? 'selected' : ''}>توقرت</option>
                    <option value="تماسين" ${prevDaira === 'تماسين' ? 'selected' : ''}>تماسين</option>
                    <option value="المقارين" ${prevDaira === 'المقارين' ? 'selected' : ''}>المقارين</option>
                    <option value="الحجيرة" ${prevDaira === 'الحجيرة' ? 'selected' : ''}>الحجيرة</option>
                    <option value="الطيبات" ${prevDaira === 'الطيبات' ? 'selected' : ''}>الطيبات</option>
                </select>

                <label style="font-weight:bold; color:#333; font-size:13px;">العنوان: <span style="color:red">*</span></label>
                <input type="text" id="setup-adrs" class="swal2-input" value="${prevAdrs}" style="margin: 5px 0 15px 0; width: 100%; height: 40px; font-size:14px; font-family: 'Cairo', sans-serif; text-align: center;" placeholder="أدخل العنوان الشخصي">

                <label style="font-weight:bold; color:#333; font-size:13px;">رقم الهاتف (موبيليس، جيزي، أوريدو): <span style="color:red">*</span></label>
                <input type="text" id="setup-phone" class="swal2-input" value="${prevPhone}" style="margin: 5px 0 15px 0; width: 100%; height: 40px; text-align:center; direction:ltr; font-size:15px; letter-spacing:1px; font-family: 'Cairo', sans-serif;" placeholder="0X XX XX XX XX" oninput="liveFormatPhone(this)">
            </div>
        `,
        allowOutsideClick: false, allowEscapeKey: false, showCancelButton: false,
        confirmButtonText: 'تأكيد وحفظ البيانات', confirmButtonColor: '#0FBA50',
        preConfirm: () => {
            const pob = document.getElementById('setup-pob').value.trim();
            const daira = document.getElementById('setup-daira').value;
            const adrs = document.getElementById('setup-adrs').value.trim();
            const phoneRaw = document.getElementById('setup-phone').value.trim();
            const phoneClean = phoneRaw.replace(/\s/g, ''); 

            if(!pob || !daira || !adrs || !phoneClean) {
                Swal.showValidationMessage('الرجاء ملء جميع الحقول الإجبارية أولاً.'); return false;
            }
            
            const arabicRegex = /^[\u0600-\u06FF\s]+$/;
            if(!arabicRegex.test(pob)) {
                Swal.showValidationMessage('عذراً.. حقل مكان الميلاد يجب أن يحتوي على حروف عربية فقط.'); return false;
            }

            const phoneRegex = /^(05|06|07)[0-9]{8}$/;
            if(!phoneRegex.test(phoneClean)) {
                Swal.showValidationMessage('رقم الهاتف غير صحيح! يجب أن يتكون من 10 أرقام ويبدأ بـ (05، 06، 07).'); return false;
            }

            return { pob: pob, daira: daira, adrs: adrs, phone: phoneRaw, infoCompleted: true };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'جاري تسجيل بياناتك...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                await db.collection("employeescomnew").doc(userDocId).update(result.value);
                loggedInUser = { ...loggedInUser, ...result.value };
                
                Swal.fire({ icon: 'success', title: 'تم بنجاح!', text: 'تم توثيق معلوماتك، يمكنك الآن متابعة التكوين.', confirmButtonColor: '#0FBA50' });
            } catch (e) {
                Swal.fire('خطأ غير متوقع', 'تعذر حفظ البيانات، يرجى المحاولة مرة أخرى.', 'error').then(() => showCompletionForm()); 
            }
        }
    });
}

function liveFormatPhone(input) {
    let val = input.value.replace(/\D/g, ''); 
    if(val.length > 10) val = val.substring(0, 10); 
    let formatted = '';
    for(let i = 0; i < val.length; i++){
        if(i > 0 && i % 2 === 0) formatted += ' '; 
        formatted += val[i];
    }
    input.value = formatted;
}

function formatPhoneString(val) {
    if(!val) return "";
    val = val.replace(/\D/g, '');
    let formatted = '';
    for(let i = 0; i < val.length; i++){
        if(i > 0 && i % 2 === 0) formatted += ' ';
        formatted += val[i];
    }
    return formatted;
}


// ==========================================
// 🔗 ربط الأزرار والمراكز (النظام الديناميكي الذكي)
// ==========================================
const swalConfig = {
    showConfirmButton: true, confirmButtonText: 'إغلاق', confirmButtonColor: '#939393',
    showCloseButton: false, scrollbarPadding: false
};



// دالة رسم المراكز في الشاشة الرئيسية
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
                <div class="icon-wrapper"><i class="fa-solid fa-school"></i></div>
                <h3>مركز التكوين<br>${cName}</h3>
            </div>
        `;
    }

    if (!hasCenters) {
        container.innerHTML = '<div style="grid-column: 1/-1; color: #dc2626; font-weight: bold; font-size: 18px; text-align:center;">لا توجد مراكز تكوين مبرمجة حالياً.</div>';
    }
}

// دالة الدخول للمركز مع الحماية
function openCenter(centerId) {
    const requiredCenterName = SITE_SETTINGS.UI_NAMES.centers[centerId];
    
    if (loggedInUser.center !== "ADMIN") {
        if (!loggedInUser.center || loggedInUser.center.trim() === "" || loggedInUser.center === "-") {
            Swal.fire({
                icon: 'warning', title: 'غير مصرح!',
                text: 'لم يتم إدراجك في أي مركز تكوين حتى الآن. يرجى مراجعة إدارة التكوين والتفتيش.',
                confirmButtonColor: '#ff9800'
            });
            return; 
        }

        if (loggedInUser.center !== requiredCenterName) {
            Swal.fire({
                icon: 'error', title: 'ممنوع الدخول!',
                html: `أنت تحاول الدخول لمركز غير مخصص لك.<br><br><b>مركزك المعتمد هو:</b> <span style="color:#0FBA50">${loggedInUser.center}</span>`,
                confirmButtonColor: '#dc3545', confirmButtonText: 'العودة'
            });
            return; 
        }
    }

    const centerLinks = SITE_SETTINGS.dbLinks[centerId] || {};
    const availableLevels = Object.keys(centerLinks);

    if (availableLevels.length === 0) {
        Swal.fire('تنبيه', 'لا توجد أطوار أو تخصصات مبرمجة في هذا المركز حالياً.', 'info');
        return;
    }

    if (availableLevels.length === 1) {
        showSpecsModal(centerId, availableLevels[0], false);
    } else {
        showLevelsModal(centerId, availableLevels);
    }
}

// دالة عرض الأطوار
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
                        ? SITE_SETTINGS.UI_NAMES.levels[lvlId] : defaultName;

        html += `
          <div class="icon-btn" onclick="showSpecsModal('${centerId}', '${lvlId}', true)">
            <i class="fa-solid ${defaultIcon}"></i>
            <span>${levelName}</span>
          </div>`;
    });
    
    html += '</div>';

    Swal.fire({ ...swalConfig, title: 'اختر الطور المستهدف:', html: html });
}

// دالة عرض التخصصات بناءً على الطور والمركز
function showSpecsModal(centerId, lvlId, showBackButton) {
    const specsData = SITE_SETTINGS.dbLinks[centerId][lvlId] || {};
    const availableSpecs = Object.keys(specsData);

    if (availableSpecs.length === 0) {
        Swal.fire('تنبيه', 'لا توجد تخصصات مبرمجة لهذا الطور.', 'info'); return;
    }

    let defaultName = lvlId;
    if (ICONS.levels[lvlId]) defaultName = ICONS.levels[lvlId].name;
    const levelName = (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels && SITE_SETTINGS.UI_NAMES.levels[lvlId]) 
                      ? SITE_SETTINGS.UI_NAMES.levels[lvlId] : defaultName;

    let html = '<div class="icon-container">';
    
    availableSpecs.forEach(spcId => {
        let spcInfo = ICONS.specs[spcId] || { name: spcId, icon: 'fa-book' };
        html += `
          <div class="icon-btn" onclick="openLink('${centerId}', '${spcId}', '${lvlId}')">
            <i class="fa-solid ${spcInfo.icon}"></i>
            <span>${spcInfo.name}</span>
          </div>`;
    });
    
    html += '</div>';

    let options = {
        ...swalConfig,
        title: `<div style="color: #0FBA50; font-size: 20px; font-weight: bold; border-bottom: 2px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 10px;">
                    <i class="fa-solid fa-layer-group"></i> ${levelName}
                </div>
                <div style="color: #475569; font-size: 16px;">يرجى اختيار التخصص المناسب:</div>`,
        html: html
    };

    if (showBackButton) {
        options.showDenyButton = true;
        options.denyButtonText = '<i class="fa-solid fa-arrow-right"></i> تراجع للوراء';
        options.denyButtonColor = '#0FBA50';
    }

    Swal.fire(options).then((result) => {
        if (result.isDenied && showBackButton) {
            const availableLevels = Object.keys(SITE_SETTINGS.dbLinks[centerId]);
            showLevelsModal(centerId, availableLevels);
        }
    });
}

// دالة التوجيه النهائي لصفحة الدروس
function openLink(centerId, type, level) {
    const targetUrl = `/courses?c=${centerId}&l=${level}&s=${type}`;
    window.location.href = targetUrl;
}

function logout() {
    Swal.fire({
        title: 'تأكيد الخروج',
        text: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، خروج',
        cancelButtonText: 'تراجع',
        confirmButtonColor: '#dc2626', // لون أحمر للتأكيد
        cancelButtonColor: '#64748b',
        buttonsStyling: true,
        customClass: {
            confirmButton: 'swal-uniform-btn',
            cancelButton: 'swal-uniform-btn'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            if (window.SecurityGuard) { SecurityGuard.logout(); } else { sessionStorage.clear(); window.location.href = "/login"; }
        }
    });
}