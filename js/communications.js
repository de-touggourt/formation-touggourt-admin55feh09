/**
 * =========================================================================
 * منظومة المراسلات والملفات الرسمية
 * فضاء التكوين البيداغوجي - مديرية التربية لولاية توقرت
 * =========================================================================
 */

// 1. فحص الأمان
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

// 3. المتغيرات العامة والجلسة
let currentEntity = {
    type: 'CENTER', // or 'DIRECTORATE'
    name: '',
    id: '',
    role: ''
};
let SITE_SETTINGS = null;
let allMessages = [];
let currentFilterTab = 'inbox';
let currentSelectedMsgId = null;
let selectedFilesToUpload = [];
let currentDateFilter = null;

// 4. تهيئة النظام عند التحميل
window.onload = function() {
    initUserIdentity();
    loadSiteSettings();
};

function initUserIdentity() {
    const empId = sessionStorage.getItem("userEmpId");
    const role = (sessionStorage.getItem("userRole") || "").toUpperCase();
    const inspectorCenter = sessionStorage.getItem("inspectorCenter");
    const userName = sessionStorage.getItem("userName") || "";

    if (empId === "ADMIN_ACCESS" || role === "ADMIN") {
        currentEntity = {
            type: 'DIRECTORATE',
            name: 'مديرية التربية لولاية توقرت',
            id: 'ADMIN_ACCESS',
            role: 'ADMIN',
            officer: userName || 'مدير النظام'
        };
        const badge = document.getElementById("userEntityName");
        if (badge) badge.innerText = "الإدارة المركزية (المديرية)";
    } else {
        currentEntity = {
            type: 'CENTER',
            name: inspectorCenter || 'مركز التكوين',
            id: empId,
            role: 'INSPECTOR',
            officer: userName || 'مشرف المركز'
        };
        const badge = document.getElementById("userEntityName");
        if (badge) badge.innerText = `مركز: ${currentEntity.name}`;
    }
}

function getEntityKey() {
    return currentEntity.type === 'DIRECTORATE' ? 'DIRECTORATE' : currentEntity.name;
}

function isMsgStarred(msg) {
    if (!msg) return false;
    const key = getEntityKey();
    const arr = Array.isArray(msg.starredBy) ? msg.starredBy : [];
    return arr.includes(key) || (currentEntity.type === 'DIRECTORATE' && (arr.includes('مديرية التربية لولاية توقرت') || arr.includes('المديرية')));
}

function isMsgArchived(msg) {
    if (!msg) return false;
    const key = getEntityKey();
    const arr = Array.isArray(msg.archivedBy) ? msg.archivedBy : [];
    return arr.includes(key) || (currentEntity.type === 'DIRECTORATE' && (arr.includes('مديرية التربية لولاية توقرت') || arr.includes('المديرية')));
}

function getMsgReceiptStatus(m) {
    const readBy = Array.isArray(m.readBy) ? m.readBy : [];
    if (m.recipientCenter === "ALL") {
        const readCount = readBy.filter(r => r !== m.senderCenter && r !== m.senderName).length;
        return {
            isRead: readCount > 0,
            text: readCount > 0 ? `قرأها ${readCount} جهات` : 'تم التعميم',
            fullText: readCount > 0 ? `تم الاطلاع من طرف ${readCount} مركز/جهة` : 'تم تسليم التعميم لكافة المراكز (بانتظار القراءة)',
            badgeClass: readCount > 0 ? 'receipt-read' : 'receipt-delivered',
            icon: readCount > 0 ? 'fa-check-double' : 'fa-check'
        };
    }

    let isRead = false;
    if (m.recipientCenter === "المديرية") {
        isRead = ['مديرية التربية لولاية توقرت', 'المديرية', 'ADMIN_ACCESS', 'DIRECTORATE'].some(k => readBy.includes(k));
    } else {
        isRead = readBy.includes(m.recipientCenter);
    }

    return {
        isRead: isRead,
        text: isRead ? 'تمت القراءة' : 'تم التسليم',
        fullText: isRead ? `تمت القراءة والاطلاع من طرف: ${m.recipientCenter}` : `تم تسليم المراسلة إلى: ${m.recipientCenter} (لم تقرأ بعد)`,
        badgeClass: isRead ? 'receipt-read' : 'receipt-delivered',
        icon: isRead ? 'fa-check-double' : 'fa-check'
    };
}

window.returnToDashboard = function() {
    const role = (sessionStorage.getItem("userRole") || currentEntity.role || "").toUpperCase();
    const empId = sessionStorage.getItem("userEmpId");
    if (role === "ADMIN" || empId === "ADMIN_ACCESS") {
        window.location.href = (window.location.protocol === "file:") ? "admin_dashboard.html" : "/admin-panel";
    } else {
        window.location.href = (window.location.protocol === "file:") ? "inspector_dashboard.html" : "/inspector";
    }
};

// 5. جلب إعدادات الموقع ومراكز التكوين
function loadSiteSettings() {
    db.collection("site_settings").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            SITE_SETTINGS = doc.data();
            populateRecipientOptions();
            listenToMessages();
        } else {
            console.warn("إعدادات الموقع غير متوفرة.");
            listenToMessages();
        }
    }, (err) => {
        console.warn("خطأ قراءة الإعدادات:", err);
        listenToMessages();
    });
}

function populateRecipientOptions() {
    const sel = document.getElementById("composeRecipient");
    if (!sel) return;
    sel.innerHTML = "";

    const centers = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.centers) ? SITE_SETTINGS.UI_NAMES.centers : {};

    if (currentEntity.type === 'DIRECTORATE') {
        // المديرية يمكنها الإرسال لجميع المراكز أو لمركز محدد
        let optAll = document.createElement("option");
        optAll.value = "ALL";
        optAll.innerText = "📢 تعميم لكافة مراكز التكوين (Broadcast)";
        sel.appendChild(optAll);

        for (let cId in centers) {
            let opt = document.createElement("option");
            opt.value = centers[cId];
            opt.innerText = `🏫 مركز: ${centers[cId]}`;
            sel.appendChild(opt);
        }
    } else {
        // المركز يمكنه الإرسال إلى المديرية، أو تعميم للمراكز، أو مركز محدد
        let optDir = document.createElement("option");
        optDir.value = "المديرية";
        optDir.innerText = "🏛️ مديرية التربية لولاية توقرت (الإدارة المركزية)";
        sel.appendChild(optDir);

        let optAll = document.createElement("option");
        optAll.value = "ALL";
        optAll.innerText = "📢 تعميم لجميع مراكز التكوين";
        sel.appendChild(optAll);

        for (let cId in centers) {
            const cName = centers[cId];
            if (cName !== currentEntity.name) {
                let opt = document.createElement("option");
                opt.value = cName;
                opt.innerText = `🏫 مركز: ${cName}`;
                sel.appendChild(opt);
            }
        }
    }
}

// 6. الاستماع اللحظي للمراسلات في Firestore
function listenToMessages() {
    const loader = document.getElementById("loader");

    db.collection("messages").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        if (loader) loader.style.display = "none";

        const msgs = [];
        snapshot.forEach((doc) => {
            const d = doc.data();
            msgs.push({ id: doc.id, ...d });
        });

        // فلترة الرسائل حسب الصلاحيات والجهة
        if (currentEntity.type === 'DIRECTORATE') {
            // المديرية تشاهد كل الرسائل الصادرة منها والواردة إليها، ومراسلات المراكز للمتابعة
            allMessages = msgs;
        } else {
            // المركز يرى:
            // 1. الرسائل التي أرسلها هو
            // 2. الرسائل الموجهة إليه تحديداً
            // 3. الرسائل المعممة (ALL)
            allMessages = msgs.filter(m => 
                m.senderCenter === currentEntity.name ||
                m.recipientCenter === currentEntity.name ||
                m.recipientCenter === "ALL"
            );
        }

        updateCounters();
        renderThreadsList();

        // تحديث عرض الرسالة الحالية إن وجدت
        if (currentSelectedMsgId) {
            const updatedMsg = allMessages.find(m => m.id === currentSelectedMsgId);
            if (updatedMsg) renderMessageDetails(updatedMsg);
        }
    }, (error) => {
        if (loader) loader.style.display = "none";
        console.error("خطأ قراءة المراسلات:", error);
    });
}

// 7. تحديث العدادات وتبويبات الفلترة
function updateCounters() {
    let total = 0;
    let inbox = 0;
    let sent = 0;
    let starred = 0;
    let archive = 0;
    let urgent = 0;

    allMessages.forEach(m => {
        const archived = isMsgArchived(m);
        const isStarredItem = isMsgStarred(m);

        if (isStarredItem) starred++;
        if (archived) {
            archive++;
            return;
        }

        total++;
        if (m.senderCenter === currentEntity.name) {
            sent++;
        } else {
            inbox++;
        }

        if (m.priority === 'urgent' || m.priority === 'official') {
            urgent++;
        }
    });

    const setCnt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setCnt("cntAll", total);
    setCnt("cntInbox", inbox);
    setCnt("cntSent", sent);
    setCnt("cntStarred", starred);
    setCnt("cntArchive", archive);
    setCnt("cntUrgent", urgent);
}

window.switchFilterTab = function(tabName, btnEl) {
    currentFilterTab = tabName;
    document.querySelectorAll(".tab-pill").forEach(p => p.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");
    renderThreadsList();
};

window.filterMessages = function() {
    renderThreadsList();
};

window.handleDateFilterChange = function() {
    const el = document.getElementById("filterDate");
    const clearBtn = document.getElementById("btnClearDate");
    if (el && el.value) {
        currentDateFilter = el.value;
        if (clearBtn) clearBtn.style.display = "inline-flex";
    } else {
        currentDateFilter = null;
        if (clearBtn) clearBtn.style.display = "none";
    }
    renderThreadsList();
};

window.clearDateFilter = function() {
    const el = document.getElementById("filterDate");
    const clearBtn = document.getElementById("btnClearDate");
    if (el) el.value = "";
    if (clearBtn) clearBtn.style.display = "none";
    currentDateFilter = null;
    renderThreadsList();
};

function getFilteredMessages() {
    const query = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();

    return allMessages.filter(m => {
        const archived = isMsgArchived(m);
        const starred = isMsgStarred(m);

        // تبويب الأرشيف يظهر فقط المراسلات المؤرشفة
        if (currentFilterTab === 'archive') {
            if (!archived) return false;
        } else {
            // بقية التبويبات تستثني المؤرشفة ما عدا تبويب المفضلة
            if (archived && currentFilterTab !== 'starred') return false;
        }

        // فلترة التبويب
        if (currentFilterTab === 'inbox' && m.senderCenter === currentEntity.name) return false;
        if (currentFilterTab === 'sent' && m.senderCenter !== currentEntity.name) return false;
        if (currentFilterTab === 'starred' && !starred) return false;
        if (currentFilterTab === 'urgent' && m.priority !== 'urgent' && m.priority !== 'official') return false;

        // فلترة التاريخ
        if (currentDateFilter) {
            let msgDate = null;
            if (m.createdAt && m.createdAt.seconds) msgDate = new Date(m.createdAt.seconds * 1000);
            else if (m.createdAt) msgDate = new Date(m.createdAt);
            if (msgDate) {
                const yyyy = msgDate.getFullYear();
                const mm = String(msgDate.getMonth() + 1).padStart(2, '0');
                const dd = String(msgDate.getDate()).padStart(2, '0');
                const msgDateStr = `${yyyy}-${mm}-${dd}`;
                if (msgDateStr !== currentDateFilter) return false;
            }
        }

        // فلترة البحث النصي
        if (query) {
            const matchSub = (m.subject || "").toLowerCase().includes(query);
            const matchContent = (m.content || "").toLowerCase().includes(query);
            const matchSender = (m.senderCenter || m.senderName || "").toLowerCase().includes(query);
            const matchRecip = (m.recipientCenter || "").toLowerCase().includes(query);
            if (!matchSub && !matchContent && !matchSender && !matchRecip) return false;
        }

        return true;
    });
}

// 8. رسم قائمة المراسلات
function renderThreadsList() {
    const container = document.getElementById("threadsContainer");
    if (!container) return;

    const list = getFilteredMessages();

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 15px; color:#94a3b8;">
                <i class="fa-solid fa-folder-open" style="font-size:35px; margin-bottom:10px;"></i>
                <p style="font-size:14px; font-weight:700; margin:0;">لا توجد مراسلات مطابقة حالياً</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(m => {
        const isSelected = m.id === currentSelectedMsgId;
        const readBy = Array.isArray(m.readBy) ? m.readBy : [];
        const isUnread = !readBy.includes(currentEntity.name) && m.senderCenter !== currentEntity.name;
        const starred = isMsgStarred(m);
        
        let priorityBadge = '';
        if (m.priority === 'urgent') priorityBadge = '<span class="priority-badge priority-urgent"><i class="fa-solid fa-circle-exclamation"></i> عاجل</span>';
        else if (m.priority === 'official') priorityBadge = '<span class="priority-badge priority-official"><i class="fa-solid fa-stamp"></i> تعميم</span>';
        else if (m.priority === 'secret') priorityBadge = '<span class="priority-badge priority-secret"><i class="fa-solid fa-lock"></i> سري</span>';
        else priorityBadge = '<span class="priority-badge priority-normal">عادي</span>';

        const hasFiles = m.files && Array.isArray(m.files) && m.files.length > 0;
        const dateStr = formatDateTime(m.createdAt);

        // شارة استلام وقراءة الرسالة للصادر
        let receiptHtml = '';
        if (m.senderCenter === currentEntity.name) {
            const rcpt = getMsgReceiptStatus(m);
            receiptHtml = `<span class="receipt-badge ${rcpt.badgeClass}" title="${escapeHtml(rcpt.fullText)}"><i class="fa-solid ${rcpt.icon}"></i> ${rcpt.text}</span>`;
        }

        return `
            <div class="thread-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}" onclick="selectMessage('${m.id}')">
                <div class="thread-header">
                    <span class="thread-sender">
                        ${starred ? '<i class="fa-solid fa-star" style="color:#eab308; margin-left:4px;" title="في المفضلة"></i>' : ''}
                        <i class="fa-solid ${m.senderType === 'DIRECTORATE' ? 'fa-shield-halved' : 'fa-school'}" style="color:${m.senderType === 'DIRECTORATE' ? '#0FBA50' : '#1E68E8'}"></i>
                        ${escapeHtml(m.senderCenter || m.senderName || 'غير معروف')}
                    </span>
                    <span class="thread-date">${dateStr}</span>
                </div>

                <div class="thread-subject">${escapeHtml(m.subject || 'بدون موضوع')}</div>

                <div class="thread-footer">
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${priorityBadge}
                        ${receiptHtml}
                    </div>
                    ${hasFiles ? `<span class="files-badge-indicator"><i class="fa-solid fa-paperclip"></i> ${m.files.length} مرفق</span>` : '<span></span>'}
                </div>
            </div>
        `;
    }).join('');
}

// 9. تحديد وقراءة المراسلة
window.selectMessage = function(msgId) {
    currentSelectedMsgId = msgId;
    const msg = allMessages.find(m => m.id === msgId);
    if (!msg) return;

    renderThreadsList();
    renderMessageDetails(msg);

    // تسجيل القراءة في Firestore
    const readBy = Array.isArray(msg.readBy) ? msg.readBy : [];
    if (!readBy.includes(currentEntity.name) && msg.senderCenter !== currentEntity.name) {
        const toUnion = (currentEntity.type === 'DIRECTORATE') ? [currentEntity.name, 'المديرية', 'ADMIN_ACCESS'] : [currentEntity.name];
        db.collection("messages").doc(msgId).update({
            readBy: firebase.firestore.FieldValue.arrayUnion(...toUnion)
        }).catch(err => console.warn("تعذر تحديث حالة القراءة:", err));
    }
};

function renderMessageDetails(msg) {
    const emptyPane = document.getElementById("emptyStatePane");
    const detailsCard = document.getElementById("messageDetailsCard");
    const viewer = document.getElementById("messageViewer");

    if (emptyPane) emptyPane.style.display = "none";
    if (detailsCard) detailsCard.style.display = "flex";
    if (viewer) viewer.classList.add("active-mobile");

    document.getElementById("viewMsgSubject").innerText = msg.subject || 'بدون موضوع';
    document.getElementById("viewMsgSender").innerText = `${msg.senderCenter || 'غير معروف'} (${msg.senderName || 'المسؤول'})`;
    
    let recipText = msg.recipientCenter || 'المديرية';
    if (recipText === "ALL") recipText = "📢 كافة مراكز التكوين";
    document.getElementById("viewMsgRecipient").innerText = recipText;
    
    document.getElementById("viewMsgDate").innerText = formatDateTime(msg.createdAt, true);
    document.getElementById("viewMsgContent").innerText = msg.content || '';

    // تحديث حالة زر المفضلة
    const btnStar = document.getElementById("btnToggleStar");
    const iconStar = document.getElementById("iconStar");
    const textStar = document.getElementById("textStar");
    const starred = isMsgStarred(msg);
    if (btnStar && iconStar && textStar) {
        if (starred) {
            btnStar.classList.add("active-star");
            iconStar.className = "fa-solid fa-star";
            textStar.innerText = "مفضلة";
        } else {
            btnStar.classList.remove("active-star");
            iconStar.className = "fa-regular fa-star";
            textStar.innerText = "المفضلة";
        }
    }

    // تحديث حالة زر الأرشيف
    const btnArch = document.getElementById("btnToggleArchive");
    const textArch = document.getElementById("textArchive");
    const archived = isMsgArchived(msg);
    if (btnArch && textArch) {
        if (archived) {
            btnArch.classList.add("active-archive");
            textArch.innerText = "مؤرشفة (إلغاء)";
        } else {
            btnArch.classList.remove("active-archive");
            textArch.innerText = "أرشفة";
        }
    }

    // شارة استلام وقراءة الرسالة
    const rcptContainer = document.getElementById("viewMsgReceiptContainer");
    const rcptBadge = document.getElementById("viewMsgReceiptBadge");
    if (rcptContainer && rcptBadge) {
        if (msg.senderCenter === currentEntity.name) {
            rcptContainer.style.display = "flex";
            const rcpt = getMsgReceiptStatus(msg);
            rcptBadge.className = `receipt-badge ${rcpt.badgeClass}`;
            rcptBadge.innerHTML = `<i class="fa-solid ${rcpt.icon}"></i> ${escapeHtml(rcpt.fullText)}`;
        } else {
            rcptContainer.style.display = "none";
        }
    }

    // البادج
    let priorityBadge = '';
    if (msg.priority === 'urgent') priorityBadge = '<span class="priority-badge priority-urgent" style="font-size:12px; padding:4px 12px;"><i class="fa-solid fa-triangle-exclamation"></i> عاجل جداً</span>';
    else if (msg.priority === 'official') priorityBadge = '<span class="priority-badge priority-official" style="font-size:12px; padding:4px 12px;"><i class="fa-solid fa-stamp"></i> تعميم رسمي</span>';
    else if (msg.priority === 'secret') priorityBadge = '<span class="priority-badge priority-secret" style="font-size:12px; padding:4px 12px;"><i class="fa-solid fa-lock"></i> سري وخاص</span>';
    else priorityBadge = '<span class="priority-badge priority-normal" style="font-size:12px; padding:4px 12px;">مراسلة عادية</span>';
    document.getElementById("viewMsgPriorityBadge").innerHTML = priorityBadge;

    // المرفقات
    const attSection = document.getElementById("viewAttachmentsSection");
    const attGrid = document.getElementById("viewAttachmentsGrid");

    if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
        attSection.style.display = "block";

        const dlAllContainer = document.getElementById("viewDownloadAllAttachmentsContainer");
        if (dlAllContainer) {
            if (msg.files.length > 1) {
                dlAllContainer.innerHTML = `
                    <button type="button" class="btn-download-all-drafts" onclick="downloadAllMessageAttachments('${msg.id}')" style="margin:0;">
                        <i class="fa-solid fa-cloud-arrow-down"></i> تحميل كافة المرفقات (${msg.files.length})
                    </button>
                `;
            } else {
                dlAllContainer.innerHTML = '';
            }
        }

        attGrid.innerHTML = msg.files.map(f => {
            const typeInfo = getFileTypeInfo(f.name, f.mime);
            const fileId = f.fileId || (f.url && (f.url.match(/id=([a-zA-Z0-9_-]+)/) || f.url.match(/\/d\/([a-zA-Z0-9_-]+)/))?.[1]) || '';
            const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : (f.url || '');
            const directDownloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : (f.url || '');
            const driveViewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : (f.url || '');
            const hasValidLink = !!(previewUrl || directDownloadUrl);

            return `
                <div class="attachment-card">
                    <div class="att-left-info">
                        <i class="fa-solid ${typeInfo.icon} att-icon"></i>
                        <div class="att-names">
                            <div class="att-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
                            <div class="att-size">${escapeHtml(f.size || 'ملف سحابي')}</div>
                        </div>
                    </div>
                    <div class="att-actions">
                        ${hasValidLink ? `
                            <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="btn-att-action" title="معاينة الملف"><i class="fa-solid fa-eye"></i></a>
                            <a href="${directDownloadUrl}" download target="_blank" rel="noopener noreferrer" class="btn-att-action" title="تحميل الملف"><i class="fa-solid fa-download"></i></a>
                        ` : `
                            <button type="button" class="btn-att-action" onclick="openOrSyncDriveFile('${escapeHtml(f.name)}', 'preview')" title="معاينة الملف"><i class="fa-solid fa-eye"></i></button>
                            <button type="button" class="btn-att-action" onclick="openOrSyncDriveFile('${escapeHtml(f.name)}', 'download')" title="تحميل الملف"><i class="fa-solid fa-download"></i></button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        attSection.style.display = "none";
    }
}

// فتح أو البحث المباشر عن ملف المراسلة في Google Drive
window.openOrSyncDriveFile = async function(fileName, mode) {
    Swal.fire({
        title: 'جاري فتح الملف...',
        html: '<div class="spinner" style="margin:0 auto 15px auto;"></div><p style="font-size:13px; color:#64748b;">جاري جلب رابط الملف السحابي من Google Drive...</p>',
        allowOutsideClick: false,
        showConfirmButton: false
    });
    try {
        const targetFolderId = (SITE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId) 
            ? SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId 
            : "13USbQnFLbCiI-fxvDc1pNjg0EEDSZ90t";
        const listRes = await fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${targetFolderId}`);
        const listData = await listRes.json();
        const filesList = Array.isArray(listData) ? listData : (Array.isArray(listData?.files) ? listData.files : []);
        const matched = filesList.find(f => f.name === fileName) || filesList.find(f => f.name.includes(fileName));
        if (matched && matched.id) {
            Swal.close();
            const url = mode === 'preview' ? `https://drive.google.com/file/d/${matched.id}/preview` : `https://drive.google.com/file/d/${matched.id}/view?usp=drivesdk`;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        Swal.fire('غير متوفر', 'تعذر العثور على هذا الملف في مجلد Google Drive حالياً.', 'warning');
    } catch(e) {
        Swal.fire('خطأ', 'حدث خطأ أثناء الاتصال بـ Google Drive.', 'error');
    }
};

// تحميل كافة مرفقات المراسلة دفعة واحدة
window.downloadAllMessageAttachments = function(msgId) {
    const msg = allMessages.find(m => m.id === msgId);
    if (!msg || !Array.isArray(msg.files) || msg.files.length === 0) return;

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: `جاري بدء تحميل ${msg.files.length} مرفقات...`,
        showConfirmButton: false,
        timer: 2000
    });

    msg.files.forEach((f, idx) => {
        setTimeout(() => {
            const fileId = f.fileId || (f.url && (f.url.match(/id=([a-zA-Z0-9_-]+)/) || f.url.match(/\/d\/([a-zA-Z0-9_-]+)/))?.[1]) || '';
            const downloadUrl = fileId 
                ? `https://drive.google.com/uc?export=download&id=${fileId}` 
                : (f.url || '');
            if (downloadUrl) {
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.target = '_blank';
                a.download = f.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }, idx * 600);
    });
};

// 10. الإجراءات المتقدمة (مفضلة، أرشفة، إعادة توجيه، رد، حذف)
window.toggleStarredCurrentMessage = async function() {
    const msg = allMessages.find(m => m.id === currentSelectedMsgId);
    if (!msg) return;

    const key = getEntityKey();
    const currentlyStarred = isMsgStarred(msg);
    const op = currentlyStarred 
        ? firebase.firestore.FieldValue.arrayRemove(key, 'مديرية التربية لولاية توقرت', 'المديرية') 
        : firebase.firestore.FieldValue.arrayUnion(key);

    try {
        await db.collection("messages").doc(msg.id).update({
            starredBy: op
        });
        
        // تحديث محلي فوري
        if (!Array.isArray(msg.starredBy)) msg.starredBy = [];
        if (currentlyStarred) {
            msg.starredBy = msg.starredBy.filter(k => k !== key && k !== 'المديرية' && k !== 'مديرية التربية لولاية توقرت');
        } else {
            msg.starredBy.push(key);
        }
        updateCounters();
        renderMessageDetails(msg);
        renderThreadsList();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: currentlyStarred ? 'تمت الإزالة من المفضلة' : 'تمت الإضافة للمفضلة ⭐',
            showConfirmButton: false,
            timer: 1500
        });
    } catch (err) {
        console.error("خطأ تحديث المفضلة:", err);
        Swal.fire('خطأ', 'تعذر تحديث المفضلة، يرجى المحاولة مرة أخرى.', 'error');
    }
};

window.toggleArchiveCurrentMessage = async function() {
    const msg = allMessages.find(m => m.id === currentSelectedMsgId);
    if (!msg) return;

    const key = getEntityKey();
    const currentlyArchived = isMsgArchived(msg);
    const op = currentlyArchived 
        ? firebase.firestore.FieldValue.arrayRemove(key, 'مديرية التربية لولاية توقرت', 'المديرية') 
        : firebase.firestore.FieldValue.arrayUnion(key);

    try {
        await db.collection("messages").doc(msg.id).update({
            archivedBy: op
        });

        if (!Array.isArray(msg.archivedBy)) msg.archivedBy = [];
        if (currentlyArchived) {
            msg.archivedBy = msg.archivedBy.filter(k => k !== key && k !== 'المديرية' && k !== 'مديرية التربية لولاية توقرت');
        } else {
            msg.archivedBy.push(key);
        }
        updateCounters();
        renderMessageDetails(msg);
        renderThreadsList();

        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: currentlyArchived ? 'تم استرجاع المراسلة من الأرشيف' : 'تم نقل المراسلة إلى الأرشيف 📦',
            showConfirmButton: false,
            timer: 1500
        });
    } catch (err) {
        console.error("خطأ تحديث الأرشيف:", err);
        Swal.fire('خطأ', 'تعذر تحديث الأرشيف، يرجى المحاولة مرة أخرى.', 'error');
    }
};

window.forwardCurrentMessage = function() {
    const msg = allMessages.find(m => m.id === currentSelectedMsgId);
    if (!msg) return;

    openComposeModal();
    
    document.getElementById("composeSubject").value = msg.subject.startsWith("توجيه: ") ? msg.subject : `توجيه: ${msg.subject}`;
    document.getElementById("composeContent").value = `\n\n---------- إعادة توجيه المراسلة ----------\nمن: ${msg.senderCenter} (${msg.senderName || ''})\nالتاريخ: ${formatDateTime(msg.createdAt, true)}\nالموضوع: ${msg.subject}\n\n${msg.content || ''}`;
    
    // إرفاق الملفات الأصلية
    if (msg.files && Array.isArray(msg.files) && msg.files.length > 0) {
        selectedFilesToUpload = msg.files.map(f => ({
            name: f.name,
            size: f.size || 'ملف سحابي',
            mime: f.mime || '',
            fileId: f.fileId || '',
            url: f.url || '',
            isPreUploaded: true
        }));
        renderSelectedFilesList();
    }
    
    document.getElementById("composeContent").focus();
};

window.deleteCurrentMessage = async function() {
    const msg = allMessages.find(m => m.id === currentSelectedMsgId);
    if (!msg) return;

    const confirmRes = await Swal.fire({
        title: 'تأكيد الحذف',
        text: `هل أنت متأكد من رغبتك في حذف المراسلة: "${msg.subject}" نهائياً؟`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    });

    if (!confirmRes.isConfirmed) return;

    try {
        await db.collection("messages").doc(msg.id).delete();
        currentSelectedMsgId = null;
        
        const emptyPane = document.getElementById("emptyStatePane");
        const detailsCard = document.getElementById("messageDetailsCard");
        const viewer = document.getElementById("messageViewer");
        if (emptyPane) emptyPane.style.display = "block";
        if (detailsCard) detailsCard.style.display = "none";
        if (viewer) viewer.classList.remove("active-mobile");

        Swal.fire({
            icon: 'success',
            title: 'تم الحذف',
            text: 'تم حذف المراسلة بنجاح.',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("خطأ أثناء حذف الرسالة:", err);
        Swal.fire('خطأ', 'تعذر حذف المراسلة، يرجى المحاولة لاحقاً.', 'error');
    }
};

window.replyToCurrentMessage = function() {
    const msg = allMessages.find(m => m.id === currentSelectedMsgId);
    if (!msg) return;

    openComposeModal();
    
    // تعيين المستلم كالمرسل الأصلي
    const sel = document.getElementById("composeRecipient");
    if (sel) {
        const target = msg.senderCenter === currentEntity.name ? msg.recipientCenter : msg.senderCenter;
        if (target) sel.value = target;
    }

    document.getElementById("composeSubject").value = msg.subject.startsWith("رد: ") ? msg.subject : `رد: ${msg.subject}`;
    document.getElementById("composeContent").focus();
};

// 11. إدارة المودال ورفع الملفات
window.openComposeModal = function() {
    selectedFilesToUpload = [];
    renderSelectedFilesList();
    document.getElementById("composeSubject").value = "";
    document.getElementById("composeContent").value = "";
    document.getElementById("composePriority").value = "normal";
    document.getElementById("composeModal").style.display = "flex";
};

window.closeComposeModal = function() {
    document.getElementById("composeModal").style.display = "none";
};

window.handleFileSelect = function(files) {
    if (!files || files.length === 0) return;

    const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 ميغابايت

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.size > MAX_FILE_SIZE) {
            Swal.fire({
                icon: 'error',
                title: 'الملف كبير جداً!',
                text: `حجم الملف "${file.name}" (${formatBytes(file.size)}) يتجاوز الحد الأقصى المسموح به وهو 30 ميغابايت.`,
                confirmButtonColor: '#ef4444'
            });
            continue;
        }

        selectedFilesToUpload.push({
            file: file,
            name: file.name,
            size: formatBytes(file.size),
            mime: file.type,
            isUploaded: false,
            isUploading: false,
            fileId: '',
            url: ''
        });
    }
    renderSelectedFilesList();
};

// دالة مركزية لرفع ملف فردي إلى Google Drive
async function uploadSingleFileToDrive(item, idx) {
    if (item.isUploaded && item.fileId) {
        return {
            name: item.name,
            size: item.size,
            mime: item.mime,
            fileId: item.fileId,
            url: item.url
        };
    }

    if (item.isPreUploaded) {
        item.isUploaded = true;
        return {
            name: item.name,
            size: item.size,
            mime: item.mime,
            fileId: item.fileId || '',
            url: item.url || (item.fileId ? `https://drive.google.com/file/d/${item.fileId}/view?usp=drivesdk` : '')
        };
    }

    const targetFolderId = (SITE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId) 
        ? SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId 
        : "13USbQnFLbCiI-fxvDc1pNjg0EEDSZ90t";

    const base64Data = await readFileAsBase64(item.file);
    const uniqueFileName = `${Date.now()}_${idx}_${item.name}`;

    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('name', uniqueFileName);
    formData.append('mime', item.mime || 'application/octet-stream');
    formData.append('data', base64Data);
    formData.append('folderId', targetFolderId);

    // استخدام سكريبت Drive الفعال والموثوق
    const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
    const data = await res.json();

    let fileId = data.id || data.fileId || '';
    let fileUrl = data.url || '';

    // إذا نجح الرفع ولم يرجع السكريبت المعرف مباشرة، نستعلم لحظياً عن المجلد
    if (!fileId && data.status === 'success') {
        try {
            const listRes = await fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${targetFolderId}`);
            const listData = await listRes.json();
            const filesList = Array.isArray(listData) ? listData : (Array.isArray(listData?.files) ? listData.files : []);
            if (filesList.length > 0) {
                const matched = filesList.find(f => f.name === uniqueFileName) || filesList.find(f => f.name === item.name) || filesList[0];
                if (matched && matched.id) {
                    fileId = matched.id;
                    fileUrl = matched.url || `https://drive.google.com/file/d/${matched.id}/view?usp=drivesdk`;
                }
            }
        } catch(listErr) {
            console.warn("تعذر الاستعلام عن ملف الدرايف:", listErr);
        }
    }

    if (!fileUrl && fileId) {
        fileUrl = `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
    }

    item.fileId = fileId;
    item.url = fileUrl;
    item.isUploaded = !!fileId;
    item.isUploading = false;

    return {
        name: item.name,
        size: item.size,
        mime: item.mime,
        fileId: fileId,
        url: fileUrl
    };
}

function renderSelectedFilesList() {
    const container = document.getElementById("selectedFilesList");
    if (!container) return;

    if (selectedFilesToUpload.length === 0) {
        container.innerHTML = "";
        return;
    }

    const unuploadedFiles = selectedFilesToUpload.filter(f => !f.isUploaded);
    const anyUploading = selectedFilesToUpload.some(f => f.isUploading);

    let topBarHtml = '';
    if (selectedFilesToUpload.length > 1 && unuploadedFiles.length > 0) {
        topBarHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <span style="font-size:12px; color:#64748b; font-weight:700;">الملفات المختارة (${selectedFilesToUpload.length}):</span>
                <button type="button" class="btn-upload-all-drafts" onclick="uploadAllDraftFiles()" ${anyUploading ? 'disabled' : ''}>
                    <i class="fa-solid fa-cloud-arrow-up"></i> رفع كافة الملفات إلى Google Drive (${unuploadedFiles.length})
                </button>
            </div>
        `;
    } else if (unuploadedFiles.length === 0 && selectedFilesToUpload.length > 0) {
        topBarHtml = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; border-radius:8px; padding:6px 12px; font-size:12px; font-weight:700; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-circle-check"></i> تم رفع كافة الملفات بنجاح إلى Google Drive، يمكنك الآن الضغط على زر "إرسال المراسلة الآن".
            </div>
        `;
    }

    const itemsHtml = selectedFilesToUpload.map((item, idx) => {
        let actionBtn = '';
        if (item.isUploading) {
            actionBtn = `<button type="button" class="btn-upload-file uploading" disabled><i class="fa-solid fa-spinner fa-spin"></i> جاري الرفع...</button>`;
        } else if (item.isUploaded) {
            actionBtn = `<span class="btn-upload-file uploaded"><i class="fa-solid fa-circle-check"></i> تم الرفع بنجاح</span>`;
        } else {
            actionBtn = `<button type="button" class="btn-upload-file" onclick="uploadDraftFile(${idx})" title="رفع هذا الملف إلى Google Drive الآن"><i class="fa-solid fa-cloud-arrow-up"></i> رفع الملف</button>`;
        }

        return `
            <div class="file-chip">
                <div class="file-chip-name">
                    <i class="fa-solid fa-file" style="color:#1E68E8;"></i>
                    <span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                    <span style="color:#94a3b8; font-size:11px;">(${item.size})</span>
                    ${item.isPreUploaded ? '<span style="color:#0FBA50; font-size:10px; font-weight:bold;">[مُرفق سحابي]</span>' : ''}
                </div>
                <div class="file-chip-actions">
                    ${actionBtn}
                    <button class="btn-remove-file" onclick="removeSelectedFile(${idx})" title="إزالة" ${item.isUploading ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = topBarHtml + itemsHtml;
}

// رفع ملف محدد قبل إرسال المراسلة
window.uploadDraftFile = async function(idx) {
    const item = selectedFilesToUpload[idx];
    if (!item || item.isUploaded || item.isUploading) return;

    item.isUploading = true;
    renderSelectedFilesList();

    try {
        const res = await uploadSingleFileToDrive(item, idx);
        if (res && res.fileId) {
            item.isUploaded = true;
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: `تم رفع "${item.name}" إلى Google Drive بنجاح!`,
                showConfirmButton: false,
                timer: 2000
            });
        } else {
            throw new Error("لم يتم إرجاع معرف الملف من Google Drive");
        }
    } catch (err) {
        console.error("خطأ أثناء رفع الملف:", err);
        item.isUploaded = false;
        Swal.fire('خطأ في الرفع', `تعذر رفع الملف "${item.name}" إلى السحابة، يرجى المحاولة مرة أخرى.`, 'error');
    } finally {
        item.isUploading = false;
        renderSelectedFilesList();
    }
};

// رفع كافة الملفات المحددة في المسودة دفعة واحدة
window.uploadAllDraftFiles = async function() {
    const unuploaded = selectedFilesToUpload.map((item, idx) => ({ item, idx })).filter(x => !x.item.isUploaded);
    if (unuploaded.length === 0) {
        return Swal.fire('تنبيه', 'كافة الملفات تم رفعها بالفعل إلى Google Drive.', 'info');
    }

    Swal.fire({
        title: 'جاري رفع الملفات إلى Google Drive...',
        html: `
            <div style="text-align:center; padding:15px;">
                <div class="spinner" style="margin: 0 auto 15px auto;"></div>
                <p id="bulkUploadText" style="color:#0FBA50; font-weight:bold; font-size:14px; margin:0;">
                    جاري رفع 1 من ${unuploaded.length}...
                </p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    let successCount = 0;
    for (let i = 0; i < unuploaded.length; i++) {
        const { item, idx } = unuploaded[i];
        try {
            item.isUploading = true;
            renderSelectedFilesList();

            const textEl = document.getElementById("bulkUploadText");
            if (textEl) textEl.innerText = `جاري رفع: ${item.name} (${i + 1}/${unuploaded.length})...`;

            const res = await uploadSingleFileToDrive(item, idx);
            if (res && res.fileId) {
                item.isUploaded = true;
                successCount++;
            }
        } catch (err) {
            console.error("خطأ أثناء رفع الملف:", err);
            item.isUploaded = false;
        } finally {
            item.isUploading = false;
        }
    }

    Swal.close();
    renderSelectedFilesList();

    if (successCount === unuploaded.length) {
        Swal.fire({
            icon: 'success',
            title: 'اكتمل الرفع بنجاح!',
            text: `تم رفع كافة الملفات (${successCount}) إلى Google Drive بنجاح. يمكنك الآن الضغط على زر "إرسال المراسلة الآن".`,
            confirmButtonColor: '#0FBA50',
            confirmButtonText: 'حسناً'
        });
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'اكتمل الرفع مع بعض الملاحظات',
            text: `تم رفع ${successCount} من أصل ${unuploaded.length} ملفات بنجاح.`,
            confirmButtonColor: '#f59e0b'
        });
    }
};

window.removeSelectedFile = function(idx) {
    selectedFilesToUpload.splice(idx, 1);
    renderSelectedFilesList();
};

// 12. إرسال المراسلة مع رفع الملفات إلى Google Drive
window.submitNewMessage = async function() {
    const recipient = document.getElementById("composeRecipient").value;
    const priority = document.getElementById("composePriority").value;
    const subject = document.getElementById("composeSubject").value.trim();
    const content = document.getElementById("composeContent").value.trim();

    if (!subject) {
        return Swal.fire('تنبيه', 'يرجى كتابة موضوع المراسلة.', 'warning');
    }
    if (!content) {
        return Swal.fire('تنبيه', 'يرجى كتابة نص المراسلة.', 'warning');
    }

    const btnSubmit = document.getElementById("btnSubmitMessage");
    btnSubmit.disabled = true;

    const unuploadedFiles = selectedFilesToUpload.filter(item => !item.isUploaded);

    Swal.fire({
        title: 'جاري إرسال المراسلة...',
        html: `
            <div style="text-align:center; padding:15px;">
                <div class="spinner" style="margin: 0 auto 15px auto;"></div>
                <p id="uploadStatusText" style="color:#0FBA50; font-weight:bold; font-size:14px; margin:0;">
                    ${unuploadedFiles.length > 0 ? 'جاري رفع الملفات المتبقية إلى Google Drive...' : 'جاري تسجيل المراسلة في النظام...'}
                </p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        // رفع ومعالجة الملفات المرفقة بالتوازي لتسريع العملية فورياً
        const uploadPromises = selectedFilesToUpload.map((item, idx) => uploadSingleFileToDrive(item, idx));
        const uploadedFilesMetadata = await Promise.all(uploadPromises);

        // تجهيز وثيقة الرسالة في Firestore
        const messageDoc = {
            senderType: currentEntity.type,
            senderCenter: currentEntity.name,
            senderName: currentEntity.officer,
            senderId: currentEntity.id,
            recipientType: (recipient === "المديرية" ? "DIRECTORATE" : (recipient === "ALL" ? "ALL_CENTERS" : "CENTER")),
            recipientCenter: recipient,
            subject: subject,
            content: content,
            priority: priority,
            files: uploadedFilesMetadata,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            readBy: [currentEntity.name],
            starredBy: [],
            archivedBy: []
        };

        await db.collection("messages").add(messageDoc);

        Swal.fire({
            icon: 'success',
            title: 'تم الإرسال بنجاح!',
            text: 'تم تسليم المراسلة الرسمية وحفظ مرفقاتها سحابياً في Google Drive.',
            confirmButtonColor: '#0FBA50'
        });

        closeComposeModal();

    } catch (e) {
        console.error("خطأ إرسال الرسالة:", e);
        Swal.fire('خطأ في الإرسال', 'تعذر حفظ المراسلة في النظام، يرجى إعادة المحاولة.', 'error');
    } finally {
        btnSubmit.disabled = false;
    }
};

// 13. دوال مساعدة
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const raw = e.target.result.split(',')[1];
            resolve(raw);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDateTime(timestamp, full = false) {
    if (!timestamp) return 'الآن';
    let date = null;
    if (timestamp.seconds) date = new Date(timestamp.seconds * 1000);
    else date = new Date(timestamp);

    if (isNaN(date.getTime())) return 'الآن';

    if (full) {
        return date.toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });
    } else {
        const now = new Date();
        const isToday = now.toDateString() === date.toDateString();
        if (isToday) {
            return date.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ar-DZ', { month: 'short', day: 'numeric' });
        }
    }
}

function getFileTypeInfo(name, mime) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const m = (mime || '').toLowerCase();

    if (ext === 'pdf' || m.includes('pdf')) return { icon: 'fa-file-pdf', css: 'red' };
    if (['doc', 'docx'].includes(ext) || m.includes('word')) return { icon: 'fa-file-word', css: 'blue' };
    if (['xls', 'xlsx'].includes(ext) || m.includes('sheet')) return { icon: 'fa-file-excel', css: 'green' };
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || m.includes('image')) return { icon: 'fa-file-image', css: 'purple' };
    if (['zip', 'rar', '7z'].includes(ext)) return { icon: 'fa-file-zipper', css: 'amber' };
    return { icon: 'fa-file-lines', css: 'slate' };
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
