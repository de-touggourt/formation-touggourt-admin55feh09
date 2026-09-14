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
let currentFilterTab = 'all';
let currentSelectedMsgId = null;
let selectedFilesToUpload = [];

// 4. تهيئة النظام عند التحميل
window.onload = function() {
    initUserIdentity();
    loadSiteSettings();
};

function initUserIdentity() {
    const empId = sessionStorage.getItem("userEmpId");
    const role = sessionStorage.getItem("userRole");
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
        document.getElementById("userEntityName").innerText = "الإدارة المركزية (المديرية)";
    } else {
        currentEntity = {
            type: 'CENTER',
            name: inspectorCenter || 'مركز تكوين',
            id: empId,
            role: 'INSPECTOR',
            officer: userName || 'مشرف المركز'
        };
        document.getElementById("userEntityName").innerText = `مركز: ${currentEntity.name}`;
    }
}

function returnToDashboard() {
    if (currentEntity.role === "ADMIN") {
        window.location.href = "/admin-panel";
    } else {
        window.location.href = "/inspector";
    }
}

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
    const total = allMessages.length;
    const inbox = allMessages.filter(m => m.senderCenter !== currentEntity.name).length;
    const sent = allMessages.filter(m => m.senderCenter === currentEntity.name).length;
    const urgent = allMessages.filter(m => m.priority === 'urgent' || m.priority === 'official').length;

    document.getElementById("cntAll").innerText = total;
    document.getElementById("cntInbox").innerText = inbox;
    document.getElementById("cntSent").innerText = sent;
    document.getElementById("cntUrgent").innerText = urgent;
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

function getFilteredMessages() {
    const query = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();

    return allMessages.filter(m => {
        // فلترة التبويب
        if (currentFilterTab === 'inbox' && m.senderCenter === currentEntity.name) return false;
        if (currentFilterTab === 'sent' && m.senderCenter !== currentEntity.name) return false;
        if (currentFilterTab === 'urgent' && m.priority !== 'urgent' && m.priority !== 'official') return false;

        // فلترة البحث
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
        
        let priorityBadge = '';
        if (m.priority === 'urgent') priorityBadge = '<span class="priority-badge priority-urgent"><i class="fa-solid fa-circle-exclamation"></i> عاجل</span>';
        else if (m.priority === 'official') priorityBadge = '<span class="priority-badge priority-official"><i class="fa-solid fa-stamp"></i> تعميم</span>';
        else if (m.priority === 'secret') priorityBadge = '<span class="priority-badge priority-secret"><i class="fa-solid fa-lock"></i> سري</span>';
        else priorityBadge = '<span class="priority-badge priority-normal">عادي</span>';

        const hasFiles = m.files && Array.isArray(m.files) && m.files.length > 0;
        const dateStr = formatDateTime(m.createdAt);

        return `
            <div class="thread-item ${isSelected ? 'active' : ''} ${isUnread ? 'unread' : ''}" onclick="selectMessage('${m.id}')">
                <div class="thread-header">
                    <span class="thread-sender">
                        <i class="fa-solid ${m.senderType === 'DIRECTORATE' ? 'fa-shield-halved' : 'fa-school'}" style="color:${m.senderType === 'DIRECTORATE' ? '#0FBA50' : '#1E68E8'}"></i>
                        ${escapeHtml(m.senderCenter || m.senderName || 'غير معروف')}
                    </span>
                    <span class="thread-date">${dateStr}</span>
                </div>

                <div class="thread-subject">${escapeHtml(m.subject || 'بدون موضوع')}</div>
                <div class="thread-preview">${escapeHtml(m.content || '')}</div>

                <div class="thread-footer">
                    <div>${priorityBadge}</div>
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
        attGrid.innerHTML = msg.files.map(f => {
            const typeInfo = getFileTypeInfo(f.name, f.mime);
            const downloadUrl = f.url || `https://drive.google.com/uc?export=download&id=${f.fileId}`;
            const previewUrl = f.fileId ? `https://drive.google.com/file/d/${f.fileId}/preview` : f.url;

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
                        <a href="${previewUrl}" target="_blank" class="btn-att-action" title="معاينة"><i class="fa-solid fa-eye"></i></a>
                        <a href="${downloadUrl}" target="_blank" class="btn-att-action" title="تحميل"><i class="fa-solid fa-download"></i></a>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        attSection.style.display = "none";
    }
}

// 10. الرد السريع
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

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        selectedFilesToUpload.push({
            file: file,
            name: file.name,
            size: formatBytes(file.size),
            mime: file.type
        });
    }
    renderSelectedFilesList();
};

function renderSelectedFilesList() {
    const container = document.getElementById("selectedFilesList");
    if (!container) return;

    if (selectedFilesToUpload.length === 0) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = selectedFilesToUpload.map((item, idx) => `
        <div class="file-chip">
            <div class="file-chip-name">
                <i class="fa-solid fa-file" style="color:#1E68E8;"></i>
                <span>${escapeHtml(item.name)}</span>
                <span style="color:#94a3b8; font-size:11px;">(${item.size})</span>
            </div>
            <button class="btn-remove-file" onclick="removeSelectedFile(${idx})" title="إزالة"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `).join('');
}

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

    Swal.fire({
        title: 'جاري إرسال المراسلة...',
        html: `
            <div style="text-align:center; padding:15px;">
                <div class="spinner" style="margin: 0 auto 15px auto;"></div>
                <p id="uploadStatusText" style="color:#0FBA50; font-weight:bold; font-size:14px; margin:0;">
                    ${selectedFilesToUpload.length > 0 ? 'جاري رفع الملفات المرفقة إلى Google Drive...' : 'جاري تسجيل المراسلة في النظام...'}
                </p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        const uploadedFilesMetadata = [];

        // رفع الملفات سحابياً على Google Drive
        for (let i = 0; i < selectedFilesToUpload.length; i++) {
            const item = selectedFilesToUpload[i];
            const statusEl = document.getElementById("uploadStatusText");
            if (statusEl) statusEl.innerText = `جاري رفع المرفق (${i + 1}/${selectedFilesToUpload.length}): ${item.name}`;

            try {
                const base64Data = await readFileAsBase64(item.file);
                const formData = new FormData();
                formData.append('action', 'upload');
                formData.append('name', item.name);
                formData.append('mime', item.mime);
                formData.append('data', base64Data);
                
                // المجلد الرئيسي إن وجد
                const rootFolder = (SITE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId) ? SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId : "";
                if (rootFolder) formData.append('folderId', rootFolder);

                const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
                const data = await res.json();

                if (data.status === 'success' || data.url || data.id) {
                    uploadedFilesMetadata.push({
                        name: item.name,
                        size: item.size,
                        mime: item.mime,
                        fileId: data.id || data.fileId || '',
                        url: data.url || (data.id ? `https://drive.google.com/file/d/${data.id}/view` : '')
                    });
                } else {
                    console.warn("فشل رفع الملف الفردي:", item.name);
                }
            } catch(uploadErr) {
                console.warn("تعذر رفع الملف إلى درايف، سيتم الحفظ بدون رابط مباشر:", uploadErr);
            }
        }

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
            readBy: [currentEntity.name]
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
