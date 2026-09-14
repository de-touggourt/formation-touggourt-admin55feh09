/**
 * =========================================================================
 * منظومة إدارة ونشر الإشعارات والتنبيهات
 * فضاء التكوين البيداغوجي - مديرية التربية لولاية توقرت
 * =========================================================================
 */

// 1. فحص الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}

// 2. إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61",
  measurementId: "G-TTJT4LQ65L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_eNgM1R-fILJq00iye9-3eeFCFjKBkMcej4VOq53gG5gshOsulAH7b-X0_JkHHrkyJw/exec";

// 3. المتغيرات العامة
let currentEntity = {
    role: 'INSPECTOR',
    name: '',
    center: '',
    id: ''
};
let SITE_SETTINGS = null;
let allNotifications = [];
let selectedImageFile = null;
let selectedTraineeData = null;

window.onload = function() {
    initIdentity();
    loadSiteSettings();
};

function initIdentity() {
    const empId = sessionStorage.getItem("userEmpId");
    const role = sessionStorage.getItem("userRole");
    const inspectorCenter = sessionStorage.getItem("inspectorCenter");
    const userName = sessionStorage.getItem("userName") || "";

    if (empId === "ADMIN_ACCESS" || role === "ADMIN") {
        currentEntity = {
            role: 'ADMIN',
            name: userName || 'مدير النظام',
            center: 'مديرية التربية لولاية توقرت',
            id: 'ADMIN_ACCESS'
        };
        document.getElementById("userEntityName").innerText = "الإدارة المركزية (المديرية)";
        document.getElementById("notifSenderDisplay").value = "مديرية التربية لولاية توقرت";
    } else {
        currentEntity = {
            role: 'INSPECTOR',
            name: userName || 'مشرف المركز',
            center: inspectorCenter || 'مركز التكوين',
            id: empId
        };
        document.getElementById("userEntityName").innerText = `مركز: ${currentEntity.center}`;
        document.getElementById("notifSenderDisplay").value = `مركز: ${currentEntity.center}`;
    }
}

function returnToDashboard() {
    if (currentEntity.role === "ADMIN") {
        window.location.href = "/admin-panel";
    } else {
        window.location.href = "/inspector";
    }
}

// 4. تحميل إعدادات الموقع وبناء خيارات الاستهداف
function loadSiteSettings() {
    db.collection("site_settings").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            SITE_SETTINGS = doc.data();
        }
        setupAudienceOptions();
        listenToNotifications();
    }, (err) => {
        console.warn("تعذر جلب الإعدادات:", err);
        setupAudienceOptions();
        listenToNotifications();
    });
}

function setupAudienceOptions() {
    const sel = document.getElementById("targetAudience");
    if (!sel) return;
    sel.innerHTML = "";

    if (currentEntity.role === "ADMIN") {
        sel.innerHTML = `
            <option value="all_trainees">👥 كافة الأساتذة المتكونين (تعميم ولائي)</option>
            <option value="center_trainees">🏫 متكونو مركز تكوين محدد</option>
            <option value="level_trainees">🎓 متكونو طور تعليمي محدد (ابتدائي / متوسط / ثانوي)</option>
            <option value="single_trainee">🎯 أستاذ متربص محدد (استدعاء/إشعار فردي)</option>
            <option value="all_centers">📢 كافة مراكز التكوين (توجيه ولائي للمشرفين)</option>
            <option value="single_center">🏫 مركز تكوين محدد (خاص بالمشرفين)</option>
        `;
    } else {
        sel.innerHTML = `
            <option value="center_trainees">👥 كافة الأساتذة المتكونين بمركزك (${currentEntity.center})</option>
            <option value="level_trainees">🎓 متكونو طور تعليمي محدد بمركزك</option>
            <option value="single_trainee">🎯 أستاذ متربص محدد بمركزك (استدعاء فردي)</option>
        `;
    }

    handleAudienceChange();
}

window.handleAudienceChange = function() {
    const val = document.getElementById("targetAudience").value;
    const group = document.getElementById("extraAudienceGroup");
    const centers = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.centers) ? SITE_SETTINGS.UI_NAMES.centers : {};

    selectedTraineeData = null;

    if (val === "center_trainees" || val === "single_center") {
        if (currentEntity.role === "ADMIN") {
            let opts = '';
            for (let cId in centers) {
                opts += `<option value="${centers[cId]}">${centers[cId]}</option>`;
            }
            group.style.display = "flex";
            group.innerHTML = `
                <label>اختر المركز المستهدف:</label>
                <select id="extraTargetCenter" class="form-control">${opts}</select>
            `;
        } else {
            group.style.display = "none";
        }
    } else if (val === "level_trainees") {
        group.style.display = "flex";
        let centerSelectHtml = '';
        if (currentEntity.role === "ADMIN") {
            let cOpts = '<option value="ALL">كافة المراكز</option>';
            for (let cId in centers) {
                cOpts += `<option value="${centers[cId]}">${centers[cId]}</option>`;
            }
            centerSelectHtml = `
                <label style="margin-top:8px;">في المركز:</label>
                <select id="extraTargetCenter" class="form-control">${cOpts}</select>
            `;
        }

        group.innerHTML = `
            <label>اختر الطور المستهدف:</label>
            <select id="extraTargetLevel" class="form-control">
                <option value="primary">الطور الابتدائي</option>
                <option value="middle">الطور المتوسط</option>
                <option value="secondary">الطور الثانوي</option>
            </select>
            ${centerSelectHtml}
        `;
    } else if (val === "single_trainee") {
        group.style.display = "flex";
        group.innerHTML = `
            <label>البحث عن الأستاذ المتربص (برقم التعريف الوظيفي أو الاسم):</label>
            <div style="display:flex; gap:8px;">
                <input type="text" id="traineeSearchQuery" class="form-control" placeholder="أدخل رقم التعريف (16 رقم) أو الاسم..." onkeydown="if(event.key==='Enter') searchTraineeForNotification()">
                <button type="button" class="btn-dispatch" style="margin:0; padding:0 18px; font-size:13px;" onclick="searchTraineeForNotification()">
                    <i class="fa-solid fa-magnifying-glass"></i> بحث
                </button>
            </div>
            <div id="traineeSearchResultCard" style="margin-top:8px;"></div>
        `;
    } else {
        group.style.display = "none";
        group.innerHTML = "";
    }
};

// 5. البحث عن أستاذ متربص للاستهداف الفردي
window.searchTraineeForNotification = async function() {
    const q = (document.getElementById("traineeSearchQuery")?.value || "").trim();
    const resultBox = document.getElementById("traineeSearchResultCard");
    if (!q || !resultBox) return;

    resultBox.innerHTML = '<div style="color:#0FBA50; font-size:13px; font-weight:700;"><i class="fa-solid fa-spinner fa-spin"></i> جاري البحث في قاعدة البيانات...</div>';

    try {
        let foundTrainee = null;

        // البحث بالمعرف المباشر
        const docSnap = await db.collection("employeescomnew").doc(q).get();
        if (docSnap.exists) {
            foundTrainee = { docId: docSnap.id, ...docSnap.data() };
        } else {
            // البحث برقم التعريف أو الاسم
            let querySnap = await db.collection("employeescomnew").where("id", "==", q).get();
            if (querySnap.empty) {
                querySnap = await db.collection("employeescomnew").where("name", "==", q).get();
            }
            if (!querySnap.empty) {
                foundTrainee = { docId: querySnap.docs[0].id, ...querySnap.docs[0].data() };
            }
        }

        if (!foundTrainee) {
            resultBox.innerHTML = '<div style="color:#dc2626; font-size:13px; font-weight:700;">❌ لم يتم العثور على أي أستاذ بهذا المعرف أو الاسم.</div>';
            selectedTraineeData = null;
            return;
        }

        // فحص صلاحية المركز إذا كان المحرر مشرف مركز
        if (currentEntity.role === "INSPECTOR" && foundTrainee.center !== currentEntity.center) {
            resultBox.innerHTML = `
                <div style="color:#dc2626; font-size:13px; font-weight:700; background:#fee2e2; padding:10px; border-radius:10px;">
                    ⚠️ هذا الأستاذ مسجل بمركز آخر (${foundTrainee.center}). بصفتك مشرفاً، يمكنك إشعار أساتذة مركزك فقط.
                </div>
            `;
            selectedTraineeData = null;
            return;
        }

        selectedTraineeData = foundTrainee;

        resultBox.innerHTML = `
            <div style="background:#f0fdf4; border:2px solid #0FBA50; border-radius:12px; padding:12px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:#102a43; font-size:14px;"><i class="fa-solid fa-circle-check" style="color:#0FBA50;"></i> ${foundTrainee.name || 'أستاذ'}</strong><br>
                    <span style="color:#64748b;">الرقم: <b>${foundTrainee.id || foundTrainee.docId}</b> | الرتبة: ${foundTrainee.grade || foundTrainee.rank || '-'} | المركز: <b>${foundTrainee.center || '-'}</b></span>
                </div>
                <span style="background:#0FBA50; color:#fff; padding:3px 10px; border-radius:12px; font-weight:700; font-size:11px;">تم التحديد</span>
            </div>
        `;

    } catch (err) {
        console.error("خطأ البحث عن المتكون:", err);
        resultBox.innerHTML = '<div style="color:#dc2626; font-size:13px;">حدث خطأ أثناء البحث في قاعدة البيانات.</div>';
    }
};

// 6. اختيار ومعاينة الصورة
window.handleImageSelect = function(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById("imagePreview").src = e.target.result;
        document.getElementById("imagePreviewContainer").style.display = "block";
    };
    reader.readAsDataURL(file);
};

window.removeSelectedImage = function() {
    selectedImageFile = null;
    document.getElementById("imagePreview").src = "";
    document.getElementById("imagePreviewContainer").style.display = "none";
    document.getElementById("notifImageInput").value = "";
};

// 7. نشر الإشعار وحفظه في Firestore
window.submitNotification = async function() {
    const audience = document.getElementById("targetAudience").value;
    const priority = document.getElementById("notifPriority").value;
    const title = document.getElementById("notifTitle").value.trim();
    const content = document.getElementById("notifContent").value.trim();

    if (!title) {
        return Swal.fire('تنبيه', 'يرجى كتابة عنوان الإشعار.', 'warning');
    }
    if (!content) {
        return Swal.fire('تنبيه', 'يرجى كتابة نص الإشعار وتفاصيله.', 'warning');
    }

    let targetCenter = "";
    let targetLevel = "";
    let targetTraineeId = "";
    let targetTraineeName = "";

    if (audience === "center_trainees" || audience === "single_center") {
        targetCenter = currentEntity.role === "ADMIN" ? (document.getElementById("extraTargetCenter")?.value || "") : currentEntity.center;
    } else if (audience === "level_trainees") {
        targetLevel = document.getElementById("extraTargetLevel")?.value || "primary";
        targetCenter = currentEntity.role === "ADMIN" ? (document.getElementById("extraTargetCenter")?.value || "ALL") : currentEntity.center;
    } else if (audience === "single_trainee") {
        if (!selectedTraineeData) {
            return Swal.fire('تنبيه', 'يرجى البحث وتحديد الأستاذ المتربص المستهدف أولاً.', 'warning');
        }
        targetTraineeId = selectedTraineeData.id || selectedTraineeData.docId;
        targetTraineeName = selectedTraineeData.name || '';
        targetCenter = selectedTraineeData.center || '';
    }

    const btn = document.getElementById("btnDispatchNotif");
    btn.disabled = true;

    Swal.fire({
        title: 'جاري نشر الإشعار...',
        html: `
            <div style="text-align:center; padding:15px;">
                <div class="spinner" style="margin:0 auto 15px auto;"></div>
                <p id="notifStatusTxt" style="color:#0FBA50; font-weight:bold; font-size:14px; margin:0;">
                    ${selectedImageFile ? 'جاري رفع الصورة المرفقة إلى Google Drive...' : 'جاري تسجيل وتعميم الإشعار...'}
                </p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        let uploadedImageUrl = "";

        // رفع الصورة المرفقة إلى Google Drive
        if (selectedImageFile) {
            try {
                const base64 = await readFileAsBase64(selectedImageFile);
                const formData = new FormData();
                formData.append('action', 'upload');
                formData.append('name', `notif_${Date.now()}_${selectedImageFile.name}`);
                formData.append('mime', selectedImageFile.type);
                formData.append('data', base64);

                const rootFolder = (SITE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId) ? SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId : "";
                if (rootFolder) formData.append('folderId', rootFolder);

                const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
                const d = await res.json();

                if (d.status === 'success' || d.id || d.url) {
                    if (d.id) {
                        uploadedImageUrl = `https://lh3.googleusercontent.com/d/${d.id}=s1200`;
                    } else if (d.url) {
                        uploadedImageUrl = d.url;
                    }
                }
            } catch(imgErr) {
                console.warn("تعذر رفع الصورة لدرايف، سيتم النشر بدونها:", imgErr);
            }
        }

        const notificationDoc = {
            title: title,
            content: content,
            imageUrl: uploadedImageUrl,
            priority: priority,
            targetAudience: audience,
            targetCenter: targetCenter,
            targetLevel: targetLevel,
            targetTraineeId: targetTraineeId,
            targetTraineeName: targetTraineeName,
            senderRole: currentEntity.role,
            senderName: currentEntity.name,
            senderCenter: currentEntity.center,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtFormatted: new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' }),
            readBy: []
        };

        await db.collection("notifications").add(notificationDoc);

        Swal.fire({
            icon: 'success',
            title: 'تم نشر الإشعار بنجاح!',
            text: 'تم تعميم وتوجيه الإشعار للفئة المحددة فورياً.',
            confirmButtonColor: '#0FBA50'
        });

        // تصفير الحقول
        document.getElementById("notifTitle").value = "";
        document.getElementById("notifContent").value = "";
        removeSelectedImage();
        handleAudienceChange();

    } catch (e) {
        console.error("خطأ نشر الإشعار:", e);
        Swal.fire('خطأ', 'حدث خطأ أثناء نشر الإشعار، يرجى المحاولة مرة أخرى.', 'error');
    } finally {
        btn.disabled = false;
    }
};

// 8. الاستماع اللحظي لسجل الإشعارات
function listenToNotifications() {
    const loader = document.getElementById("loader");

    db.collection("notifications").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        if (loader) loader.style.display = "none";

        allNotifications = [];
        snapshot.forEach((doc) => {
            allNotifications.push({ id: doc.id, ...doc.data() });
        });

        // فلترة سجل الإشعارات حسب الجهة
        let displayList = allNotifications;
        if (currentEntity.role === "INSPECTOR") {
            displayList = allNotifications.filter(n => 
                n.senderCenter === currentEntity.center ||
                n.targetCenter === currentEntity.center ||
                n.targetAudience === "all_centers"
            );
        }

        renderNotificationsFeed(displayList);
    }, (err) => {
        if (loader) loader.style.display = "none";
        console.error("خطأ قراءة الإشعارات:", err);
    });
}

function renderNotificationsFeed(list) {
    const container = document.getElementById("notificationsFeed");
    const countBadge = document.getElementById("historyCountBadge");
    if (!container) return;

    if (countBadge) countBadge.innerText = `${list.length} إشعار`;

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 15px; color:#94a3b8;">
                <i class="fa-regular fa-bell-slash" style="font-size:35px; margin-bottom:10px;"></i>
                <p style="font-size:14px; font-weight:700; margin:0;">لم يتم نشر أي إشعارات بعد.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(n => {
        let audBadge = '<span class="badge-aud">الجميع</span>';
        if (n.targetAudience === "all_trainees") audBadge = '<span class="badge-aud"><i class="fa-solid fa-users"></i> كافة المتكونين</span>';
        else if (n.targetAudience === "center_trainees") audBadge = `<span class="badge-aud"><i class="fa-solid fa-school"></i> ${n.targetCenter || 'مركز محدد'}</span>`;
        else if (n.targetAudience === "level_trainees") audBadge = `<span class="badge-aud"><i class="fa-solid fa-layer-group"></i> طور: ${n.targetLevel}</span>`;
        else if (n.targetAudience === "single_trainee") audBadge = `<span class="badge-aud" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-user-tag"></i> فردي: ${n.targetTraineeName || n.targetTraineeId}</span>`;
        else if (n.targetAudience === "all_centers") audBadge = '<span class="badge-aud" style="background:#e0f2fe; color:#0284c7;"><i class="fa-solid fa-bullhorn"></i> كافة المراكز</span>';
        else if (n.targetAudience === "single_center") audBadge = `<span class="badge-aud"><i class="fa-solid fa-school"></i> مركز: ${n.targetCenter}</span>`;

        let prioBadge = '<span class="badge-prio prio-normal">عادي</span>';
        if (n.priority === 'urgent') prioBadge = '<span class="badge-prio prio-urgent"><i class="fa-solid fa-triangle-exclamation"></i> عاجل</span>';
        else if (n.priority === 'summon') prioBadge = '<span class="badge-prio prio-summon"><i class="fa-solid fa-envelope-open-text"></i> استدعاء رسمي</span>';

        const hasImg = n.imageUrl && n.imageUrl.trim() !== '';
        const imgThumb = hasImg ? `
            <div class="feed-img-thumb" onclick="previewImageZoom('${n.imageUrl}')">
                <img src="${n.imageUrl}" alt="الصورة المرفقة" referrerpolicy="no-referrer">
            </div>
        ` : `
            <div class="feed-img-thumb" style="cursor:default;">
                <i class="fa-solid fa-bell"></i>
            </div>
        `;

        const canDelete = currentEntity.role === "ADMIN" || n.senderCenter === currentEntity.center;

        return `
            <div class="feed-item">
                ${imgThumb}
                <div class="feed-body">
                    <div class="feed-top">
                        <div class="feed-title">${escapeHtml(n.title || 'إشعار')}</div>
                        <div class="feed-badges">
                            ${prioBadge}
                            ${audBadge}
                        </div>
                    </div>
                    <div class="feed-text">${escapeHtml(n.content || '')}</div>
                    <div class="feed-footer">
                        <span><i class="fa-solid fa-building-flag"></i> ${escapeHtml(n.senderCenter || n.senderName || 'المديرية')} | ${n.createdAtFormatted || 'الآن'}</span>
                        <div class="feed-actions">
                            <button class="btn-feed-action" onclick="previewNotificationItem('${n.id}')">
                                <i class="fa-solid fa-eye"></i> معاينة
                            </button>
                            ${canDelete ? `
                                <button class="btn-feed-action btn-feed-delete" onclick="deleteNotificationItem('${n.id}')">
                                    <i class="fa-solid fa-trash-can"></i> حذف
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 9. معاينة وتكبير الصورة
window.previewImageZoom = function(url) {
    if (!url) return;
    Swal.fire({
        imageUrl: url,
        imageAlt: 'الصورة المرفقة بالحجم الكامل',
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
        width: 'auto'
    });
};

window.previewNotificationItem = function(id) {
    const notif = allNotifications.find(n => n.id === id);
    if (!notif) return;

    // تسجيل القراءة في النظام
    const readerTag = currentEntity.role === "ADMIN" ? "المديرية" : currentEntity.center;
    if (readerTag) {
        db.collection("notifications").doc(id).update({
            readBy: firebase.firestore.FieldValue.arrayUnion(readerTag, currentEntity.name || '')
        }).catch(() => {});
    }

    let imageHtml = '';
    if (notif.imageUrl && notif.imageUrl.trim() !== '') {
        imageHtml = `
            <div style="margin:15px 0; text-align:center;">
                <img src="${notif.imageUrl}" alt="الصورة المرفقة" style="max-width:100%; max-height:350px; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer;" onclick="previewImageZoom('${notif.imageUrl}')">
            </div>
        `;
    }

    Swal.fire({
        title: `<div style="font-family:'Cairo'; font-size:18px; font-weight:800; color:#102a43;">${notif.title || 'تفاصيل الإشعار'}</div>`,
        html: `
            <div style="text-align:right; direction:rtl; font-family:'Cairo'; padding:5px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:12px; color:#64748b; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                    <span>المرسل: <b>${notif.senderCenter || notif.senderName}</b></span>
                    <span>التاريخ: ${notif.createdAtFormatted || 'الآن'}</span>
                </div>
                <div style="font-size:14px; line-height:1.8; color:#334155; white-space:pre-wrap; background:#fff; padding:15px; border-radius:10px; border:1px solid #cbd5e1;">
${notif.content || ''}
                </div>
                ${imageHtml}
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
        width: '700px'
    });
};

window.deleteNotificationItem = function(id) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من رغبتك في حذف هذا الإشعار نهائياً من النظام؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذفه',
        cancelButtonText: 'تراجع',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await db.collection("notifications").doc(id).delete();
                Swal.fire('تم!', 'تم حذف الإشعار بنجاح.', 'success');
            } catch(e) {
                console.error("فشل حذف الإشعار:", e);
                Swal.fire('خطأ', 'تعذر حذف الإشعار.', 'error');
            }
        }
    });
};

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
