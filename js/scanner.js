// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}
// إعدادات Firebase الخاصة بك
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

// ================= إعدادات الصور والمطابقة =================
const PHOTO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSe-P_rRLZ0iiQtC1oB9mAkaNJ3b1r0pUsWpQgPznW4k5mItoMxlPjROd9wpev6rUjBw/exec"; 
let employeePhotosMap = {}; 

function extractCoreId(val) {
    if (!val) return "";
    let str = String(val).trim().toUpperCase();
    let digitsOnly = str.replace(/\D/g, "");
    let core = digitsOnly.replace(/^0+/, ""); 
    return core === "" ? digitsOnly : core;
}

let html5QrCode;
let todayDate = "";
let isScanningPaused = false; 
let activeCenter = "";
let scannedCardsCount = 0; 

window.onload = async function() {
    const d = new Date();
    todayDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById("dateInfo").innerText = `جاري التحقق من الرابط والأمان...`;

    // 1. استخراج الرمز السري من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
        Swal.fire({
            icon: 'error', title: 'رابط غير صالح',
            text: 'الرابط غير كامل وينقصه الرمز السري.',
            allowOutsideClick: false, showConfirmButton: false
        });
        return; 
    }

    // 2. جلب الصور في الخلفية لتكون جاهزة عند المسح
    fetch(`${PHOTO_SCRIPT_URL}?type=employees`).then(async (photoRes) => {
        const responseText = await photoRes.text();
        if (responseText && responseText.includes("[")) {
            const photoData = JSON.parse(responseText);
            photoData.forEach(item => {
                if(item.jobId && item.photoUrl) {
                    const coreJobId = extractCoreId(item.jobId);
                    let directUrl = item.photoUrl;
                    const match = directUrl.match(/id=([a-zA-Z0-9_-]+)/) || directUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match) directUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`;
                    employeePhotosMap[coreJobId] = directUrl;
                }
            });
        }
    }).catch(e => console.warn("تعذر جلب الصور:", e));

    // 3. توليد أو جلب بصمة الجهاز الحالي لحماية الرابط
    let myDeviceId = localStorage.getItem('scanner_device_id');
    if (!myDeviceId) {
        myDeviceId = 'DEV_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('scanner_device_id', myDeviceId);
    }

    try {
        // 4. التحقق من الرمز في قاعدة البيانات
        let tokenDoc = await db.collection('scanner_tokens').doc(token).get();
        if (!tokenDoc.exists) {
            Swal.fire({
                icon: 'error', title: 'رابط منتهي أو غير صحيح',
                text: 'هذا الرابط غير صالح أو تم إبطاله من قبل رئيس المركز.',
                allowOutsideClick: false, showConfirmButton: false
            });
            return;
        }

        let tokenData = tokenDoc.data();

        // التحقق من حماية الجهاز الموحد
        if (tokenData.registeredDevice) {
            if (tokenData.registeredDevice !== myDeviceId) {
                Swal.fire({
                    icon: 'error', 
                    title: 'حظر أمني: الرابط مستخدم!',
                    text: 'هذا الرابط تم استخدامه مسبقاً في هاتف/جهاز آخر ومقفل عليه. اطلب رابطاً جديداً من رئيس المركز.',
                    allowOutsideClick: false, 
                    showConfirmButton: false
                });
                return; 
            }
        } else {
            // تسجيل هذا الجهاز ليقفل عليه
            await db.collection('scanner_tokens').doc(token).update({
                registeredDevice: myDeviceId
            });
        }
        
        // 5. السماح بالدخول وتحديد المركز
        activeCenter = tokenData.center;
        
        document.getElementById("dateInfo").innerHTML = `تاريخ السجل: ${todayDate}<br><span style="color:#0FBA50; font-weight:bold; font-size:16px;">المركز: ${activeCenter}</span>`;
        
        startScanner();
    } catch (error) {
        console.error("Token error:", error);
        Swal.fire('خطأ', 'تعذر التحقق من الرابط. تأكد من اتصالك بالإنترنت.', 'error');
    }
};

function startScanner() {
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        Swal.fire('خطأ في الكاميرا', 'يرجى السماح للمتصفح بالوصول إلى كاميرا الهاتف.', 'error');
    });
}

async function onScanSuccess(decodedText, decodedResult) {
    if (isScanningPaused) return; 
    let scannedId = decodedText.trim();
    isScanningPaused = true; 

    let audio = new Audio('https://www.soundjay.com/buttons/sounds/button-09.mp3');
    audio.play().catch(e=>console.log(e));

    try {
        // ==========================================
        // 1. البحث في المتكونين
        // ==========================================
        let traineeSnap = await db.collection("employeescomnew").where("id", "==", scannedId).get();
        
        if (!traineeSnap.empty) {
            let trainee = { empId: traineeSnap.docs[0].data().id, ...traineeSnap.docs[0].data() };
            let centerName = trainee.center;

            if (!centerName || centerName.trim() !== activeCenter.trim()) {
                Swal.fire({ icon: 'warning', title: 'خطأ في البيانات', text: `المتكون لا ينتمي لمركزك الحالي!`, confirmButtonText: 'حسناً' }).then(() => { isScanningPaused = false; });
                return;
            }

            // === تجهيز صورة المتكون ===
            let photoUrl = trainee.photoUrl_fb ? trainee.photoUrl_fb : employeePhotosMap[extractCoreId(scannedId)];
            const photoHtml = photoUrl 
                ? `<img src="${photoUrl}" style="width: 85px; height: 85px; border-radius: 50%; object-fit: cover; border: 3px solid #0FBA50; margin: 0 auto 10px auto; display: block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`
                : `<div style="width: 85px; height: 85px; border-radius: 50%; background: #f1f5f9; display: flex; justify-content: center; align-items: center; border: 3px solid #ccc; margin: 0 auto 10px auto;"><i class="fa-solid fa-user" style="font-size: 40px; color: #cbd5e1;"></i></div>`;

            const docId = `${centerName.trim()}_${todayDate}`;
            let attDoc = await db.collection('attendance_daily').doc(docId).get();
            let sysMode = "closed"; 
            let existingRecords = {}; 

            if (attDoc.exists) {
                let data = attDoc.data();
                if (data.systemMode) sysMode = data.systemMode;
                if (data.records) existingRecords = data.records;
            }

            if (existingRecords[trainee.empId] && existingRecords[trainee.empId].time && existingRecords[trainee.empId].time !== '') {
                Swal.fire({
                    icon: 'info', title: 'مسجل مسبقاً!',
                    html: `
                        <div class="swal-welcome-card" style="text-align: center;">
                            ${photoHtml}
                            <span style="font-weight: bold; font-size: 16px;">${trainee.name || '-'}</span><br>
                            <span style="color:#0FBA50; font-weight:bold;">الوضعية الحالية: ${existingRecords[trainee.empId].status}</span>
                        </div>
                    `,
                    confirmButtonText: 'استمرار المسح', timer: 8000, timerProgressBar: true
                }).then(() => { isScanningPaused = false; });
                return;
            }

            if (sysMode === "closed") {
                Swal.fire({ icon: 'error', title: 'النظام مغلق', text: `تسجيل حضور المتكونين مغلق حالياً.`, confirmButtonText: 'استمرار المسح', confirmButtonColor: '#d90429' }).then(() => { isScanningPaused = false; }); 
                return;
            }

            const d = new Date();
            const timeString = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            let status = sysMode === "open" ? "حاضر" : "متأخر";
            let badgeClass = status === "حاضر" ? "badge-present" : "badge-late";
            let iconClass = status === "حاضر" ? "fa-user-check" : "fa-user-clock";

            await db.collection('attendance_daily').doc(docId).set({
                center: centerName.trim(), date: todayDate,
                records: { [trainee.empId]: { status: status, time: timeString } }
            }, { merge: true });

            scannedCardsCount++;
            document.getElementById("scanCountValue").innerText = scannedCardsCount;

            Swal.fire({
                title: 'تم التسجيل بنجاح!',
                html: `
                    <div class="swal-welcome-card">
                        <div style="text-align:center;">
                            ${photoHtml}
                            <span class="swal-badge ${badgeClass}"><i class="fa-solid ${iconClass}"></i> تم تسجيله: ${status} (${timeString})</span>
                        </div>
                        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;">
                        <b>المركز:</b> ${centerName}<br>
                        <b>الاسم واللقب:</b> ${trainee.name || '-'}<br>
                        <b>الرتبة:</b> ${trainee.grade || trainee.rank || '-'}<br>
                        <b>مادة التخصص:</b> ${trainee.maty || trainee.specialty || '-'}
                    </div>
                `,
                icon: 'success', confirmButtonText: 'مسح البطاقة التالية', timer: 20000, timerProgressBar: true
            }).then(() => { isScanningPaused = false; });

        } else {
            // ==========================================
            // 2. البحث في المؤطرين
            // ==========================================
            let framerDocId = `${scannedId}_${activeCenter.trim()}`;
            let framerDoc = await db.collection("center_framers").doc(framerDocId).get();
            
            if (!framerDoc.exists) {
                Swal.fire({ icon: 'error', title: 'غير مسجل', text: `الرقم (${scannedId}) غير مسجل في مركزك (لا متكون ولا مؤطر)!`, confirmButtonText: 'حسناً', confirmButtonColor: '#203a43' }).then(() => { isScanningPaused = false; });
                return;
            }

            let framerData = framerDoc.data();
            let centerName = framerData.center.trim();
            const docId = `${centerName}_${todayDate}`;
            
            // جلب الاسم والصورة من القاعدة الأساسية
            let baseSnap = await db.collection("employeescomnew").doc(scannedId).get();
            if (!baseSnap.exists) baseSnap = await db.collection("employeescomplus").doc(scannedId).get();
            
            let framerBaseData = baseSnap.exists ? baseSnap.data() : {};
            let framerName = framerBaseData.name || 'غير متوفر';
            
            // === تجهيز صورة المؤطر ===
            let photoUrlFramer = framerBaseData.photoUrl_fb ? framerBaseData.photoUrl_fb : employeePhotosMap[extractCoreId(scannedId)];
            const photoHtmlFramer = photoUrlFramer 
                ? `<img src="${photoUrlFramer}" style="width: 85px; height: 85px; border-radius: 50%; object-fit: cover; border: 3px solid #1E68E8; margin: 0 auto 10px auto; display: block; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">`
                : `<div style="width: 85px; height: 85px; border-radius: 50%; background: #f1f5f9; display: flex; justify-content: center; align-items: center; border: 3px solid #ccc; margin: 0 auto 10px auto;"><i class="fa-solid fa-user-tie" style="font-size: 40px; color: #cbd5e1;"></i></div>`;

            let attDoc = await db.collection('framers_attendance_daily').doc(docId).get();
            let sysMode = "closed"; 
            let existingRecords = {}; 

            if (attDoc.exists) {
                let data = attDoc.data();
                if (data.systemMode) sysMode = data.systemMode;
                if (data.records) existingRecords = data.records;
            }

            if (existingRecords[scannedId] && existingRecords[scannedId].time && existingRecords[scannedId].time !== '') {
                Swal.fire({
                    icon: 'info', title: 'مسجل مسبقاً!',
                    html: `
                        <div class="swal-welcome-card" style="text-align: center;">
                            ${photoHtmlFramer}
                            <span style="font-weight: bold; font-size: 16px;">${framerName}</span><br>
                            <span style="color:#0FBA50; font-weight:bold;">الوضعية الحالية: ${existingRecords[scannedId].status}</span>
                        </div>
                    `,
                    confirmButtonText: 'استمرار المسح', timer: 8000, timerProgressBar: true
                }).then(() => { isScanningPaused = false; });
                return; 
            }

            if (sysMode === "closed") {
                Swal.fire({ icon: 'error', title: 'النظام مغلق', text: `تسجيل حضور المؤطرين مغلق حالياً.`, confirmButtonText: 'استمرار المسح', confirmButtonColor: '#d90429' }).then(() => { isScanningPaused = false; }); 
                return;
            }

            const d = new Date();
            const timeString = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            let status = "حاضر"; 

            await db.collection('framers_attendance_daily').doc(docId).set({
                center: centerName, date: todayDate,
                records: { [scannedId]: { status: status, time: timeString } }
            }, { merge: true });

            scannedCardsCount++;
            document.getElementById("scanCountValue").innerText = scannedCardsCount;

            Swal.fire({
                title: 'تم التسجيل بنجاح!',
                html: `
                    <div class="swal-welcome-card">
                        <div style="text-align:center;">
                            ${photoHtmlFramer}
                            <span class="swal-badge" style="background: linear-gradient(45deg, #1E68E8, #004ecc);"><i class="fa-solid fa-user-tie"></i> مؤطر: ${status} (${timeString})</span>
                        </div>
                        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;">
                        <b>المركز:</b> ${centerName}<br>
                        <b>الاسم واللقب:</b> ${framerName}<br>
                        <b>الوظيفة بالمركز:</b> ${framerData.role || '-'}
                    </div>
                `,
                icon: 'success', confirmButtonText: 'مسح البطاقة التالية', timer: 20000, timerProgressBar: true
            }).then(() => { isScanningPaused = false; });
        }

    } catch (error) {
        console.error("Error:", error);
        Swal.fire('خطأ', 'حدث مشكل في الاتصال بقاعدة البيانات', 'error').then(() => { isScanningPaused = false; });
    }
}

function onScanFailure(error) { 
    // تجاهل الأخطاء الصامتة
}