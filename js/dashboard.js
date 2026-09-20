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

// أيقونات افتراضية للأطوار والتخصصات (تُستخدم كاحتياطي)
const DEFAULT_ICONS = {
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
            result[key] = { name: specs[key], icon: (specIcons[key] && specIcons[key].icon) || 'fa-book' };
        }
    }
    return result;
}

// ==========================================
// 🔡 كود الكتابة السلسة
// ==========================================
const textToType = "الجمهورية الجزائرية الديمقراطية الشعبية | وزارة التربية الوطنية | مديرية التربية لولاية توقرت";
const typeWriterElement = document.getElementById('typewriter-text');

function typeWriter() {
    if (typeWriterElement) {
        typeWriterElement.innerHTML = textToType;
    }
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
        initTraineeNotifications();

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
                <input type="text" id="setup-phone" class="swal2-input" value="${prevPhone}" style="margin: 5px 0 5px 0; width: 100%; height: 40px; text-align:center; direction:ltr; font-size:15px; letter-spacing:1px; font-family: 'Cairo', sans-serif;" placeholder="0X XX XX XX XX" oninput="liveFormatPhone(this); window.checkPhoneAvailability(this)" onblur="window.checkPhoneAvailability(this)">
                <div id="phone-feedback" style="font-size:12px; font-weight:bold; margin-bottom:10px; min-height:18px; text-align:center;"></div>
            </div>
        `,
        allowOutsideClick: false, allowEscapeKey: false, showCancelButton: false,
        confirmButtonText: 'تأكيد وحفظ البيانات', confirmButtonColor: '#0FBA50',
        preConfirm: async () => {
            const pob = document.getElementById('setup-pob').value.trim();
            const daira = document.getElementById('setup-daira').value;
            const adrs = document.getElementById('setup-adrs').value.trim();
            const phoneRaw = document.getElementById('setup-phone').value.trim();
            const phoneClean = phoneRaw.replace(/\D/g, ''); 

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

            // فحص منع الأرقام الوهمية أو المتكررة
            const last8 = phoneClean.substring(2);
            if (/^(\d)\1{7}$/.test(last8) || last8 === '12345678' || last8 === '87654321' || last8 === '01234567') {
                Swal.showValidationMessage('رقم الهاتف المدخل غير صالح (أرقام وهمية أو متكررة)! يرجى إدخال رقم هاتفك الشخصي الحقيقي.');
                return false;
            }

            const phoneFormatted = formatPhoneString(phoneClean);

            // 🔍 فحص منع تكرار رقم الهاتف لأكثر من متكون في قاعدة البيانات
            try {
                const variants = Array.from(new Set([
                    phoneClean,
                    phoneFormatted,
                    phoneRaw,
                    "+213" + phoneClean.substring(1),
                    "00213" + phoneClean.substring(1)
                ])).filter(Boolean);

                const existingSnap = await db.collection("employeescomnew")
                    .where("phone", "in", variants)
                    .get();

                let isDuplicate = false;
                const currentEmpId = String(loggedInUser.id || loggedInUser.empId || userDocId || "").trim();

                existingSnap.forEach(doc => {
                    const d = doc.data();
                    const docEmpId = String(d.id || d.empId || doc.id || "").trim();
                    if (doc.id !== userDocId && docEmpId !== currentEmpId) {
                        isDuplicate = true;
                    }
                });

                if (isDuplicate) {
                    Swal.showValidationMessage('عذراً، رقم الهاتف هذا مسجل بالفعل لمتكون آخر! يجب على كل متكون إدخال رقم هاتفه الشخصي الخاص.');
                    return false;
                }
            } catch (err) {
                console.warn("فحص التكرار في Firestore:", err);
            }

            return { pob: pob, daira: daira, adrs: adrs, phone: phoneFormatted, infoCompleted: true };
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

// دالة فحص توفر رقم الهاتف لحظياً عند الإدخال وتنبيه المتكون فورياً
window.checkPhoneAvailability = async function(input) {
    const feedback = document.getElementById("phone-feedback");
    if (!feedback) return;
    const phoneClean = (input.value || "").replace(/\D/g, "");
    if (phoneClean.length < 10) {
        feedback.innerHTML = "";
        return;
    }
    const phoneRegex = /^(05|06|07)[0-9]{8}$/;
    if (!phoneRegex.test(phoneClean)) {
        feedback.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-triangle-exclamation"></i> يجب أن يتكون الرقم من 10 أرقام ويبدأ بـ (05 أو 06 أو 07)</span>`;
        return;
    }

    const last8 = phoneClean.substring(2);
    if (/^(\d)\1{7}$/.test(last8) || last8 === '12345678' || last8 === '87654321' || last8 === '01234567') {
        feedback.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-circle-xmark"></i> رقم غير صالح (أرقام وهمية أو متكررة)</span>`;
        return;
    }

    feedback.innerHTML = `<span style="color:#64748b;"><i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق من توفر الرقم...</span>`;

    try {
        const variants = Array.from(new Set([
            phoneClean,
            formatPhoneString(phoneClean),
            input.value.trim(),
            "+213" + phoneClean.substring(1),
            "00213" + phoneClean.substring(1)
        ])).filter(Boolean);

        const snap = await db.collection("employeescomnew")
            .where("phone", "in", variants)
            .get();

        let isDuplicate = false;
        const currentEmpId = String(loggedInUser.id || loggedInUser.empId || userDocId || "").trim();

        snap.forEach(doc => {
            const d = doc.data();
            const docEmpId = String(d.id || d.empId || doc.id || "").trim();
            if (doc.id !== userDocId && docEmpId !== currentEmpId) {
                isDuplicate = true;
            }
        });

        if (isDuplicate) {
            feedback.innerHTML = `<span style="color:#dc2626;"><i class="fa-solid fa-circle-xmark"></i> عذراً، هذا الرقم مسجل لمتكون آخر!</span>`;
        } else {
            feedback.innerHTML = `<span style="color:#16a34a;"><i class="fa-solid fa-circle-check"></i> رقم الهاتف متاح وخاص بك</span>`;
        }
    } catch(e) {
        feedback.innerHTML = "";
    }
};

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

const KNOWN_SPECS_COMMON = {
    'arabic': { name: 'اللغة العربية', keywords: ['عرب', 'أدب'] },
    'french': { name: 'اللغة الفرنسية', keywords: ['فرنس'] },
    'english': { name: 'اللغة الإنجليزية', keywords: ['إنجليز', 'انجليز'] },
    'sport': { name: 'التربية البدنية والرياضية', keywords: ['بدن', 'رياضة', 'بدنية'] },
    'math': { name: 'الرياضيات', keywords: ['رياضيات', 'حساب'] },
    'physics': { name: 'العلوم الفيزيائية والتكنولوجيا', keywords: ['فيزياء', 'فيزيائ'] },
    'science': { name: 'علوم الطبيعة والحياة', keywords: ['طبيعة', 'علوم'] },
    'history_geo': { name: 'التاريخ والجغرافيا', keywords: ['تاريخ', 'جغرافيا'] },
    'islamic': { name: 'العلوم الإسلامية', keywords: ['إسلام', 'اسلام', 'شريعة'] },
    'philosophy': { name: 'الفلسفة', keywords: ['فلسف'] },
    'art': { name: 'التربية التشكيلية والرسم', keywords: ['رسم', 'تشكيل'] },
    'music': { name: 'التربية الموسيقية', keywords: ['موسيق'] },
    'civil_eng': { name: 'الهندسة المدنية', keywords: ['مدني'] },
    'electrical_eng': { name: 'الهندسة الكهربائية', keywords: ['كهربا'] },
    'mechanical_eng': { name: 'الهندسة الميكانيكية', keywords: ['ميكانيك'] },
    'process_eng': { name: 'هندسة الطرائق', keywords: ['طرائق'] },
    'informatics': { name: 'الإعلام الآلي', keywords: ['إعلام آلي', 'اعلام آلي', 'حاسوب'] },
    'amazigh': { name: 'اللغة الأمازيغية', keywords: ['أمازيغ', 'امازيغ'] },
    'economy': { name: 'تسيير واقتصاد', keywords: ['تسيير', 'اقتصاد', 'محاسبة'] },
    'others': { name: 'باقي التخصصات', keywords: [] }
};

// ================= دالة كشف الطور والتخصص بدقة =================
function detectUserLevelAndSpec(user) {
    if (!user) return { levelKey: null, specKey: null };
    
    const rankStr = (user.grade || user.rank || "").toLowerCase();
    const matyStr = (user.maty || user.specialty || "").trim().toLowerCase();
    
    // 1. الطور - مطابقة ديناميكية مع أسماء الأطوار من SITE_SETTINGS
    let levelKey = null;
    const levels = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels) || {};
    for (let key in levels) {
        const levelName = levels[key].toLowerCase();
        const keywords = levelName.replace(/الطور|\s/g, '').trim();
        if (keywords && (rankStr.includes(keywords) || keywords.includes(rankStr.replace(/أستاذ|التعليم|\s/g, '')))) {
            levelKey = key;
            break;
        }
    }
    if (!levelKey) {
        if (rankStr.includes("ابتدائي")) levelKey = "primary";
        else if (rankStr.includes("متوسط")) levelKey = "middle";
        else if (rankStr.includes("ثانوي")) levelKey = "secondary";
    }
    
    // 2. التخصص - فحص دقيق: استثناء الرياضيات أولاً قبل فحص التربية البدنية
    let specKey = null;
    
    if (matyStr.includes('رياضيات') || matyStr.includes('حساب')) {
        specKey = 'math';
    } else if (matyStr.includes('بدن') || matyStr.includes('رياضة') || matyStr.includes('بدنية')) {
        specKey = 'sport';
    }
    
    if (!specKey) {
        const specs = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.specs) || {};
        for (let key in specs) {
            const specName = specs[key].toLowerCase();
            const sClean = specName.replace(/^ال/, '').trim();
            const mClean = matyStr.replace(/^ال/, '').trim();
            if (sClean === mClean || mClean.includes(sClean) || sClean.includes(mClean)) {
                specKey = key;
                break;
            }
        }
    }
    
    if (!specKey) {
        for (let k in KNOWN_SPECS_COMMON) {
            if (KNOWN_SPECS_COMMON[k].keywords && KNOWN_SPECS_COMMON[k].keywords.some(kw => matyStr.includes(kw))) {
                specKey = k;
                break;
            }
        }
    }
    
    if (!specKey) specKey = "others";

    return { levelKey, specKey, rawLevel: user.grade || user.rank, rawSpec: user.maty || user.specialty };
}

// دالة الدخول للمركز مع الحماية وحصر المتكون بتخصصه
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

    // 🌟 حصر المتكون لتخصصه وطوره مباشرة دون فتح تخصصات الآخرين 🌟
    const userRole = sessionStorage.getItem("userRole");
    if (userRole === "USER" || !sessionStorage.getItem("inspectorCenter")) {
        const detected = detectUserLevelAndSpec(loggedInUser);
        const myLvl = detected.levelKey || availableLevels[0];
        const mySpec = detected.specKey || 'others';

        const iconsLevels = getIconsLevels();
        const iconsSpecs = getIconsSpecs();
        const levelName = (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels && SITE_SETTINGS.UI_NAMES.levels[myLvl]) || (iconsLevels[myLvl] ? iconsLevels[myLvl].name : myLvl);
        const specName = (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.specs && SITE_SETTINGS.UI_NAMES.specs[mySpec]) || (iconsSpecs[mySpec] ? iconsSpecs[mySpec].name : loggedInUser.maty || 'تخصصك المعتمد');

        Swal.fire({
            title: `<div style="font-family:'Cairo'; color:#0FBA50; font-size:20px; font-weight:800;"><i class="fa-solid fa-graduation-cap"></i> فضاء مقاييس التكوين</div>`,
            html: `
                <div style="text-align:center; padding:10px; font-family:'Cairo';">
                    <p style="font-size:16px; color:#1e293b; margin:0 0 15px 0;">مرحباً بك أستاذ(ة): <b>${loggedInUser.name || ''}</b></p>
                    <div style="background:#f0fdf4; border:2px dashed #0FBA50; border-radius:16px; padding:15px; margin-bottom:15px; text-align:right;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                            <span style="color:#64748b;">المركز:</span>
                            <span style="font-weight:700; color:#102a43;">${requiredCenterName}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                            <span style="color:#64748b;">الطور التعليمي:</span>
                            <span style="font-weight:700; color:#1E68E8;">${levelName}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:15px;">
                            <span style="color:#64748b;">التخصص المعتمد:</span>
                            <span style="font-weight:800; color:#0FBA50;"><i class="fa-solid fa-book-open"></i> ${specName}</span>
                        </div>
                    </div>
                    <p style="font-size:13px; color:#64748b; margin:0;">وفقاً لتعليمات النظام، يتم توجيهك مباشرة لملفات ومقاييس تخصصك فقط.</p>
                </div>
            `,
            showConfirmButton: true,
            confirmButtonText: '<i class="fa-solid fa-arrow-left"></i> الدخول لمقاييس تخصصي الآن',
            confirmButtonColor: '#0FBA50',
            showCancelButton: true,
            cancelButtonText: 'إلغاء',
            cancelButtonColor: '#94a3b8'
        }).then((res) => {
            if (res.isConfirmed) {
                openLink(centerId, mySpec, myLvl);
            }
        });
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
    const iconsLevels = getIconsLevels();
    
    availableLevels.forEach(lvlId => {
        let defaultIcon = 'fa-layer-group';
        let defaultName = lvlId;
        
        if (iconsLevels[lvlId]) {
            defaultIcon = iconsLevels[lvlId].icon;
            defaultName = iconsLevels[lvlId].name;
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

    const iconsLevels = getIconsLevels();
    const iconsSpecs = getIconsSpecs();

    let defaultName = lvlId;
    if (iconsLevels[lvlId]) defaultName = iconsLevels[lvlId].name;
    const levelName = (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.levels && SITE_SETTINGS.UI_NAMES.levels[lvlId]) 
                      ? SITE_SETTINGS.UI_NAMES.levels[lvlId] : defaultName;

    let html = '<div class="icon-container">';
    
    availableSpecs.forEach(spcId => {
        let spcInfo = iconsSpecs[spcId] || { name: spcId, icon: 'fa-book' };
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

// ==========================================================================
// 🔔 نظام الإشعارات الذكي والموجه للمتكون (Trainee Notifications System)
// ==========================================================================
let traineeNotificationsList = [];
let isInitialTraineeNotifLoad = true;

function initTraineeNotifications() {
    const empId = sessionStorage.getItem("userEmpId");
    if (!empId) return;

    try {
        db.collection("notifications").onSnapshot((snapshot) => {
            if (!snapshot) return;

            const allNotifs = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                allNotifs.push({ id: doc.id, ...data });
            });

            // فرز تنازلي حسب تاريخ الإنشاء
            allNotifs.sort((a, b) => {
                const tA = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : (new Date(a.createdAt || 0).getTime() / 1000);
                const tB = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : (new Date(b.createdAt || 0).getTime() / 1000);
                return tB - tA;
            });

            // فلترة الإشعارات الموجهة لهذا المتكون حصراً
            const detected = detectUserLevelAndSpec(loggedInUser);
            const userCenter = loggedInUser.center || "";
            const userLevel = detected.levelKey || "";

            const prevUnreadCount = traineeNotificationsList.filter(n => !getReadNotifsMap()[n.id]).length;

            traineeNotificationsList = allNotifs.filter(n => {
                const aud = n.targetAudience;
                if (aud === "all_trainees") return true;
                if (aud === "center_trainees" && n.targetCenter === userCenter) return true;
                if (aud === "level_trainees" && (n.targetLevel === userLevel || n.targetLevel === "all")) {
                    if (!n.targetCenter || n.targetCenter === userCenter || n.targetCenter === "ALL") return true;
                }
                if (aud === "single_trainee" || aud === "specific_trainees") {
                    const coreEmpId = extractCoreId(empId);
                    if (n.targetTraineeId === empId || n.targetTraineeId === coreEmpId) return true;
                    if (Array.isArray(n.targetTraineeIds)) {
                        return n.targetTraineeIds.includes(empId) || n.targetTraineeIds.includes(coreEmpId);
                    }
                    return false;
                }
                return false;
            });

            updateTraineeNotifBadge();

            // تنبيه لحظي عند وصول إشعار جديد أثناء تصفح المتكون
            const currentUnread = traineeNotificationsList.filter(n => !getReadNotifsMap()[n.id]);
            if (!isInitialTraineeNotifLoad && currentUnread.length > prevUnreadCount) {
                const latest = currentUnread[0];
                Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 5000,
                    timerProgressBar: true
                }).fire({
                    icon: latest.priority === 'urgent' ? 'warning' : 'info',
                    title: latest.title || 'إشعار وتنبيه جديد',
                    text: 'وردك إشعار وتنبيه رسمي جديد من الإدارة'
                });
            }
            isInitialTraineeNotifLoad = false;

            // فحص وجود استدعاء أو إشعار عاجل غير مقروء لإظهاره تلقائياً لمرة واحدة
            checkAndTriggerUrgentNotice();

        }, (err) => {
            console.warn("تعذر الاتصال بمركز الإشعارات:", err);
        });
    } catch (e) {
        console.warn("خطأ في نظام الإشعارات:", e);
    }
}

function getReadNotifsMap() {
    try {
        const stored = sessionStorage.getItem("read_trainee_notifs");
        return stored ? JSON.parse(stored) : {};
    } catch(e) {
        return {};
    }
}

function markNotifAsRead(notifId) {
    try {
        const readMap = getReadNotifsMap();
        readMap[notifId] = Date.now();
        sessionStorage.setItem("read_trainee_notifs", JSON.stringify(readMap));
        updateTraineeNotifBadge();
    } catch(e) {}
}

function updateTraineeNotifBadge() {
    const badgeEl = document.getElementById("traineeNotifCount");
    const bellBtn = document.getElementById("btnTraineeNotif");
    if (!badgeEl) return;

    const readMap = getReadNotifsMap();
    const unreadCount = traineeNotificationsList.filter(n => !readMap[n.id]).length;

    if (unreadCount > 0) {
        badgeEl.innerText = unreadCount > 99 ? '99+' : unreadCount;
        badgeEl.style.display = "flex";
        if (bellBtn) bellBtn.classList.add("has-unread");
    } else {
        badgeEl.style.display = "none";
        if (bellBtn) bellBtn.classList.remove("has-unread");
    }
}

function checkAndTriggerUrgentNotice() {
    const readMap = getReadNotifsMap();
    const urgentNotif = traineeNotificationsList.find(n => 
        (n.priority === 'urgent' || n.priority === 'summon') && 
        !readMap[n.id] && 
        !sessionStorage.getItem(`shown_urgent_${n.id}`)
    );

    if (urgentNotif) {
        sessionStorage.setItem(`shown_urgent_${urgentNotif.id}`, "true");
        showNotificationModal(urgentNotif);
    }
}

window.openTraineeNotifications = function() {
    const readMap = getReadNotifsMap();

    if (!traineeNotificationsList || traineeNotificationsList.length === 0) {
        return Swal.fire({
            title: '<i class="fa-solid fa-bell" style="color:#0FBA50;"></i> الإشعارات والتنبيهات',
            html: `
                <div style="padding:30px 20px; text-align:center; color:#64748b;">
                    <i class="fa-regular fa-bell-slash" style="font-size:45px; color:#cbd5e1; margin-bottom:12px;"></i>
                    <p style="font-size:15px; font-weight:700; margin:0;">لا توجد أي إشعارات جديدة موجهة إليك حالياً.</p>
                </div>
            `,
            confirmButtonText: 'حسناً',
            confirmButtonColor: '#0FBA50'
        });
    }

    let itemsHtml = '<div style="display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow-y:auto; padding:5px; text-align:right; direction:rtl;">';

    traineeNotificationsList.forEach((notif) => {
        const isRead = !!readMap[notif.id];
        const isUrgent = notif.priority === 'urgent' || notif.priority === 'summon';
        const bgStyle = isRead ? 'background:#f8fafc; border:1px solid #e2e8f0;' : 'background:#ffffff; border:2px solid #0FBA50; box-shadow:0 4px 12px rgba(15,186,80,0.1);';
        
        let priorityBadge = '<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;">إعلان عام</span>';
        if (notif.priority === 'urgent') priorityBadge = '<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> عاجل</span>';
        else if (notif.priority === 'summon') priorityBadge = '<span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:8px; font-size:11px; font-weight:800;"><i class="fa-solid fa-envelope-open-text"></i> استدعاء رسمي</span>';

        const senderText = notif.senderCenter || notif.senderName || 'مديرية التربية';
        const dateStr = notif.createdAtFormatted || (notif.createdAt && notif.createdAt.seconds ? new Date(notif.createdAt.seconds * 1000).toLocaleDateString('ar-DZ') : 'الآن');

        itemsHtml += `
            <div onclick="showNotificationModalById('${notif.id}')" style="${bgStyle} border-radius:14px; padding:12px 15px; cursor:pointer; transition:0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${!isRead ? '<span style="width:10px; height:10px; background:#0FBA50; border-radius:50%; display:inline-block;"></span>' : ''}
                        <strong style="font-size:15px; color:#1e293b;">${notif.title || 'إشعار جديد'}</strong>
                    </div>
                    ${priorityBadge}
                </div>
                <div style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
                    ${notif.content || ''}
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:#94a3b8; border-top:1px dashed #e2e8f0; padding-top:6px;">
                    <span><i class="fa-solid fa-building-user"></i> ${senderText}</span>
                    <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                </div>
            </div>
        `;
    });

    itemsHtml += '</div>';

    Swal.fire({
        title: '<div style="display:flex; align-items:center; gap:8px; font-family:\'Cairo\';"><i class="fa-solid fa-bell" style="color:#0FBA50;"></i> الإشعارات والتنبيهات الموجهة إليك</div>',
        html: itemsHtml,
        width: '650px',
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
        scrollbarPadding: false
    });
};

window.showNotificationModalById = function(notifId) {
    const notif = traineeNotificationsList.find(n => n.id === notifId);
    if (notif) showNotificationModal(notif);
};

function showNotificationModal(notif) {
    markNotifAsRead(notif.id);

    const isUrgent = notif.priority === 'urgent' || notif.priority === 'summon';
    const senderText = notif.senderCenter || notif.senderName || 'مديرية التربية لولاية توقرت';
    const dateStr = notif.createdAtFormatted || (notif.createdAt && notif.createdAt.seconds ? new Date(notif.createdAt.seconds * 1000).toLocaleString('ar-DZ') : 'الآن');

    let imageHtml = '';
    if (notif.imageUrl && notif.imageUrl.trim() !== '') {
        let fId = notif.imageFileId || '';
        if (!fId) {
            if (notif.imageUrl.includes('id=')) fId = notif.imageUrl.split('id=')[1].split('&')[0];
            else if (notif.imageUrl.includes('/d/')) fId = notif.imageUrl.split('/d/')[1].split(/[=/]/)[0];
        }
        let fullSrc = notif.imageUrl || '';
        let fbSrc = '';
        if (!fullSrc.startsWith('data:image/') && fId) {
            fullSrc = `https://drive.google.com/thumbnail?id=${fId}&sz=w1200`;
            fbSrc = `https://lh3.googleusercontent.com/d/${fId}=s1200`;
        }

        imageHtml = `
            <div style="margin:15px 0; text-align:center;">
                <img src="${fullSrc}" alt="مرفق الإشعار" referrerpolicy="no-referrer" onerror="if(!this.dataset.retried && '${fbSrc}'){this.dataset.retried=1; this.src='${fbSrc}';}" style="max-width:100%; max-height:350px; border-radius:12px; border:2px solid #e2e8f0; object-fit:contain; box-shadow:0 4px 15px rgba(0,0,0,0.1); cursor:zoom-in;" onclick="previewTraineeNotifZoom('${fullSrc}', '${fId}')">
                <div style="font-size:11px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-magnifying-glass-plus"></i> انقر على الصورة لفتحها بالحجم الكامل</div>
            </div>
        `;
    }

    Swal.fire({
        title: `<div style="font-family:'Cairo'; font-size:20px; font-weight:800; color:${isUrgent ? '#dc2626' : '#102a43'};">${notif.title || 'تفاصيل الإشعار'}</div>`,
        html: `
            <div style="text-align:right; direction:rtl; font-family:'Cairo'; padding:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:10px 14px; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:15px; font-size:12px; color:#475569;">
                    <span><i class="fa-solid fa-shield-halved" style="color:#0FBA50;"></i> <b>الجهة المرسلة:</b> ${senderText}</span>
                    <span><i class="fa-regular fa-calendar-check"></i> ${dateStr}</span>
                </div>

                <div style="font-size:15px; line-height:1.9; color:#1e293b; background:#ffffff; border-radius:12px; padding:15px; border:1px solid #cbd5e1; white-space:pre-wrap; word-break:break-word;">
${notif.content || ''}
                </div>

                ${imageHtml}
            </div>
        `,
        width: '750px',
        showConfirmButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> تم الاطلاع والمصادقة',
        confirmButtonColor: '#0FBA50',
        scrollbarPadding: false
    });
}

window.previewTraineeNotifZoom = function(url, fileId) {
    if (!url && !fileId) return;
    let fId = fileId || '';
    if (!fId && url) {
        if (url.includes('id=')) fId = url.split('id=')[1].split('&')[0];
        else if (url.includes('/d/')) fId = url.split('/d/')[1].split(/[=/]/)[0];
    }
    const zoomSrc = fId ? `https://drive.google.com/thumbnail?id=${fId}&sz=w1600` : url;
    const fbSrc = fId ? `https://lh3.googleusercontent.com/d/${fId}=s1600` : '';

    Swal.fire({
        html: `
            <div style="text-align:center; padding:5px;">
                <img src="${zoomSrc}" alt="معاينة الصورة" referrerpolicy="no-referrer" onerror="if(!this.dataset.retried && '${fbSrc}'){this.dataset.retried=1; this.src='${fbSrc}';}" style="max-width:100%; max-height:80vh; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.15); object-fit:contain;">
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
        width: 'auto',
        scrollbarPadding: false
    });
};

function logout() {
    Swal.fire({
        title: 'تأكيد الخروج',
        text: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، خروج',
        cancelButtonText: 'تراجع',
        confirmButtonColor: '#dc2626',
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
