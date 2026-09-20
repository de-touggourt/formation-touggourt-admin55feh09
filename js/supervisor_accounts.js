// التحقق الأمني من الجلسة
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}

// إعدادات Firebase
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

const PHOTO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzSe-P_rRLZ0iiQtC1oB9mAkaNJ3b1r0pUsWpQgPznW4k5mItoMxlPjROd9wpev6rUjBw/exec";

let INSPECTOR_CENTER = "";
let supervisorsList = [];
let supervisorAccountsMap = {};
let framersBaseDataCache = {};
let employeePhotosMap = {};

try {
    const cachedPhotos = sessionStorage.getItem("employeePhotosMap_cache");
    if (cachedPhotos) employeePhotosMap = JSON.parse(cachedPhotos);
} catch (e) {}

function extractCoreId(val) {
    if (!val) return "";
    let digitsOnly = String(val).trim().toUpperCase().replace(/\D/g, "");
    let core = digitsOnly.replace(/^0+/, ""); 
    return core === "" ? digitsOnly : core;
}

window.onload = function() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "flex";

    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    const userRole = (sessionStorage.getItem("userRole") || "").toUpperCase();
    const userEmpId = sessionStorage.getItem("userEmpId");
    INSPECTOR_CENTER = sessionStorage.getItem("inspectorCenter") || "";

    const urlParams = new URLSearchParams(window.location.search);
    const paramCenter = urlParams.get("center") || urlParams.get("c");
    if (paramCenter) {
        INSPECTOR_CENTER = decodeURIComponent(paramCenter);
        sessionStorage.setItem("inspectorCenter", INSPECTOR_CENTER);
    }

    if ((userEmpId === "ADMIN_ACCESS" || userRole === "ADMIN") && !INSPECTOR_CENTER) {
        INSPECTOR_CENTER = "المقر الإداري - توقرت";
        sessionStorage.setItem("inspectorCenter", INSPECTOR_CENTER);
    }

    if (!isLoggedIn || (!INSPECTOR_CENTER && userEmpId !== "ADMIN_ACCESS")) {
        window.location.href = (window.location.protocol === "file:") ? "admin095526.html" : "/secure-login";
        return;
    }

    if (document.getElementById("headerCenterName")) {
        document.getElementById("headerCenterName").innerText = INSPECTOR_CENTER;
    }

    loadSupervisorsData();
};

async function fetchEmployeeBaseData(empId) {
    if (!empId) return null;
    let safeId = String(empId).trim();
    if (framersBaseDataCache[safeId]) return framersBaseDataCache[safeId];

    try {
        let snapPlus = await db.collection("employeescomplus").doc(safeId).get();
        if (snapPlus.exists) {
            let d = snapPlus.data();
            framersBaseDataCache[safeId] = d;
            return d;
        }
        let snapNew = await db.collection("employeescomnew").doc(safeId).get();
        if (snapNew.exists) {
            let d = snapNew.data();
            framersBaseDataCache[safeId] = d;
            return d;
        }
    } catch (e) {
        console.warn("خطأ في جلب بيانات الموظف الأساسية:", e);
    }
    return null;
}

async function loadSupervisorsData() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "flex";

    try {
        // 1. الاستماع اللحظي لحسابات الأساتذة المؤطرين المسجلة في supervisor_accounts
        db.collection("supervisor_accounts")
          .where("center", "==", INSPECTOR_CENTER)
          .onSnapshot(async (accSnap) => {
              supervisorAccountsMap = {};
              accSnap.forEach(doc => {
                  const data = doc.data();
                  if (data.empId) {
                      supervisorAccountsMap[String(data.empId)] = { ...data, docId: doc.id };
                  }
              });
              renderCombinedTable();
          });

        // 2. الاستماع اللحظي للمؤطرين المسجلين في هذا المركز من center_framers
        db.collection("center_framers")
          .where("center", "==", INSPECTOR_CENTER)
          .onSnapshot(async (framerSnap) => {
              const promises = framerSnap.docs.map(async (doc) => {
                  let d = doc.data();
                  if (!d.empId || doc.id.startsWith("settings_")) return null;

                  // قراءة التخصصات والمقاييس والأفواج والرتب من كلا الصيغتين لضمان التوافق
                  let specs = d.framingSpecs || d.specs || [];
                  let modules = d.framingModules || d.modules || [];
                  let groups = d.framingGroups || d.groups || [];
                  let supervisedRanks = d.framingRanks || d.supervisedRanks || (d.rank && d.rank !== '-' ? [d.rank] : []);

                  // تصفية الأساتذة المؤطرين (أو من يحمل مهام تأطير بيداغوجي)
                  let isTeacher = (d.role === "أستاذ مؤطر" || d.role === "أستاذ(ة) مكون(ة)" || modules.length > 0 || specs.length > 0);
                  
                  let base = await fetchEmployeeBaseData(d.empId);
                  return {
                      framerDocId: doc.id,
                      empId: String(d.empId),
                      role: d.role || "أستاذ مؤطر",
                      isTeacher: isTeacher,
                      name: (base && base.name) ? base.name : (d.name || "أستاذ مؤطر"),
                      rank: (base && (base.grade || base.rank)) ? (base.grade || base.rank) : (d.rank || "-"),
                      workplace: (base && (base.place || base.workplace)) ? (base.place || base.workplace) : (d.workplace || "-"),
                      phone: d.phone || (base ? base.phone : "-"),
                      specs: specs,
                      modules: modules,
                      groups: groups,
                      supervisedRanks: supervisedRanks,
                      s1: (typeof d.s1 !== 'undefined') ? !!d.s1 : true,
                      s2: (typeof d.s2 !== 'undefined') ? !!d.s2 : false,
                      s3: (typeof d.s3 !== 'undefined') ? !!d.s3 : false,
                      baseInfo: base,
                      center: INSPECTOR_CENTER
                  };
              });

              let results = await Promise.all(promises);
              supervisorsList = results.filter(x => x !== null && x.isTeacher);

              populateSpecFilter();
              renderCombinedTable();

              if (loader) loader.style.display = "none";
          }, (err) => {
              console.error("خطأ في جلب بيانات المؤطرين:", err);
              if (loader) loader.style.display = "none";
              Swal.fire("خطأ", "تعذر الاتصال بقاعدة بيانات المؤطرين.", "error");
          });

    } catch (err) {
        console.error("خطأ غير متوقع:", err);
        if (loader) loader.style.display = "none";
    }
}

function populateSpecFilter() {
    const specFilter = document.getElementById("specFilter");
    if (!specFilter) return;

    const currentVal = specFilter.value;
    specFilter.innerHTML = '<option value="الكل">كل التخصصات</option>';

    let allSpecs = new Set();
    supervisorsList.forEach(s => {
        if (Array.isArray(s.specs)) {
            s.specs.forEach(sp => allSpecs.add(sp));
        }
    });

    Array.from(allSpecs).sort().forEach(sp => {
        specFilter.innerHTML += `<option value="${sp}">${sp}</option>`;
    });

    if (currentVal && allSpecs.has(currentVal)) {
        specFilter.value = currentVal;
    }
}

function renderCombinedTable() {
    const tbody = document.getElementById("accountsTableBody");
    if (!tbody) return;

    const searchInput = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
    const statusFilter = document.getElementById("statusFilter")?.value || "الكل";
    const specFilter = document.getElementById("specFilter")?.value || "الكل";

    let countTotal = supervisorsList.length;
    let countActive = 0;
    let countDisabled = 0;
    let countPending = 0;

    const processedList = supervisorsList.map(s => {
        const acc = supervisorAccountsMap[s.empId];
        let status = "pending";
        if (acc) {
            status = acc.status || "active";
        }
        if (status === "active") countActive++;
        else if (status === "disabled") countDisabled++;
        else countPending++;

        return { ...s, account: acc, status: status };
    });

    // تحديث بطاقات الإحصائيات
    if (document.getElementById("st-total")) document.getElementById("st-total").innerText = countTotal;
    if (document.getElementById("st-active")) document.getElementById("st-active").innerText = countActive;
    if (document.getElementById("st-disabled")) document.getElementById("st-disabled").innerText = countDisabled;
    if (document.getElementById("st-pending")) document.getElementById("st-pending").innerText = countPending;

    // الفلترة
    const filtered = processedList.filter(item => {
        if (statusFilter !== "الكل" && item.status !== statusFilter) return false;
        if (specFilter !== "الكل" && (!item.specs || !item.specs.includes(specFilter))) return false;

        if (searchInput) {
            const matchName = (item.name || "").toLowerCase().includes(searchInput);
            const matchId = (item.empId || "").toLowerCase().includes(searchInput);
            const matchRank = (item.rank || "").toLowerCase().includes(searchInput);
            const matchPlace = (item.workplace || "").toLowerCase().includes(searchInput);
            const matchSpecs = (item.specs || []).join(" ").toLowerCase().includes(searchInput);
            const matchModules = (item.modules || []).join(" ").toLowerCase().includes(searchInput);
            if (!matchName && !matchId && !matchRank && !matchPlace && !matchSpecs && !matchModules) {
                return false;
            }
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="padding: 40px; color:#64748b; font-size:15px; font-weight:700;"><i class="fa-solid fa-inbox" style="font-size:32px; display:block; margin-bottom:10px; color:#cbd5e1;"></i>لا توجد بيانات مطابقة لخيارات البحث بالمركز الحالي.</td></tr>`;
        return;
    }

    let rowsHtml = "";
    let idx = 1;

    filtered.forEach(sup => {
        const coreEmpId = extractCoreId(sup.empId);
        const fbUrl = sup.baseInfo?.photoUrl_fb;
        const driveUrl = employeePhotosMap[coreEmpId];
        const photoUrl = fbUrl || driveUrl || "";

        // بناء شارات التخصصات والمقاييس
        let specsHtml = "";
        if (sup.specs && sup.specs.length > 0) {
            specsHtml += sup.specs.map(sp => `<span class="tag-item tag-spec"><i class="fa-solid fa-book-bookmark"></i> ${sp}</span>`).join(" ");
        }
        if (sup.modules && sup.modules.length > 0) {
            specsHtml += (specsHtml ? "<br>" : "") + sup.modules.map(m => `<span class="tag-item"><i class="fa-solid fa-chalkboard"></i> ${m}</span>`).join(" ");
        }
        if (!specsHtml) specsHtml = '<span style="color:#94a3b8; font-size:12px;">غير محدد</span>';

        // بناء شارات الأفواج والرتب المشرف عليها
        let groupsAndRanksHtml = "";
        if (sup.groups && sup.groups.length > 0) {
            groupsAndRanksHtml += sup.groups.map(g => {
                let cleanG = g.includes("::") ? g.split("::")[1] : g;
                return `<span class="tag-item tag-grp"><i class="fa-solid fa-users"></i> ${cleanG}</span>`;
            }).join(" ");
        }
        if (sup.supervisedRanks && sup.supervisedRanks.length > 0) {
            groupsAndRanksHtml += (groupsAndRanksHtml ? "<br>" : "") + sup.supervisedRanks.map(r => `<span class="tag-item tag-rank"><i class="fa-solid fa-graduation-cap"></i> ${r}</span>`).join(" ");
        }
        if (!groupsAndRanksHtml) groupsAndRanksHtml = '<span style="color:#94a3b8; font-size:12px;">-</span>';

        // شارة الحالة
        let statusBadge = "";
        if (sup.status === "active") {
            statusBadge = `<span class="status-badge status-active"><i class="fa-solid fa-circle-check"></i> معتمد ونشط</span>`;
        } else if (sup.status === "disabled") {
            statusBadge = `<span class="status-badge status-disabled"><i class="fa-solid fa-ban"></i> معطل</span>`;
        } else {
            statusBadge = `<span class="status-badge status-pending"><i class="fa-solid fa-clock"></i> غير معتمد</span>`;
        }

        // أزرار الإجراءات
        let actionButtons = "";
        if (sup.status === "active") {
            actionButtons = `
                <button class="btn-act btn-disable" onclick="disableSupervisorAccount('${sup.empId}')" title="تعطيل الحساب مؤقتاً">
                    <i class="fa-solid fa-ban"></i> تعطيل
                </button>
                <button class="btn-act btn-delete" onclick="deleteSupervisorAccount('${sup.empId}')" title="حذف الحساب">
                    <i class="fa-solid fa-trash-can"></i> حذف
                </button>
            `;
        } else if (sup.status === "disabled") {
            actionButtons = `
                <button class="btn-act btn-enable" onclick="enableSupervisorAccount('${sup.empId}')" title="إعادة تفعيل الحساب">
                    <i class="fa-solid fa-check"></i> تفعيل
                </button>
                <button class="btn-act btn-delete" onclick="deleteSupervisorAccount('${sup.empId}')" title="حذف الحساب">
                    <i class="fa-solid fa-trash-can"></i> حذف
                </button>
            `;
        } else {
            // غير معتمد
            actionButtons = `
                <button class="btn-act btn-approve" onclick="approveSupervisorAccount('${sup.empId}')" title="اعتماد وإنشاء الحساب في النظام">
                    <i class="fa-solid fa-shield-check"></i> اعتماد الحساب
                </button>
            `;
        }

        rowsHtml += `
            <tr>
                <td style="font-weight:bold; color:#64748b;">${idx++}</td>
                <td>
                    <div class="profile-pic-container">
                        ${photoUrl ? `<img src="${photoUrl}" class="profile-pic-img" alt="صورة">` : `<i class="fa-solid fa-user profile-pic-placeholder"></i>`}
                    </div>
                    <div style="font-weight:800; color:#102a43; font-size:12px; margin-top:4px; letter-spacing:0.5px;">${sup.empId}</div>
                </td>
                <td style="font-weight:800; color:#0f172a; text-align:right;">${sup.name}</td>
                <td style="font-weight:600; text-align:right;">${sup.rank}</td>
                <td style="font-weight:600; text-align:right; color:#475569;">${sup.workplace}</td>
                <td style="text-align:right;">${specsHtml}</td>
                <td style="text-align:right;">${groupsAndRanksHtml}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
                        ${actionButtons}
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

window.filterAccountsTable = function() {
    renderCombinedTable();
};

window.refreshData = function() {
    loadSupervisorsData();
};

// ================= اعتماد الحساب =================
window.approveSupervisorAccount = async function(empId) {
    const sup = supervisorsList.find(x => x.empId === empId);
    if (!sup) return;

    Swal.fire({
        title: 'اعتماد حساب الأستاذ المؤطر',
        html: `
            <div style="text-align:right; font-family:'Cairo'; font-size:14px; line-height:1.8;">
                هل ترغب في اعتماد وتفعيل حساب الأستاذ: <b>${sup.name}</b>؟<br>
                <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:10px; margin-top:10px;">
                    <i class="fa-solid fa-check-circle" style="color:#16a34a;"></i> 
                    سيتمكن الأستاذ من تسجيل الدخول مباشرة من صفحة الدخول الأولى باستخدام رقمه الوظيفي: 
                    <b style="color:#102a43; direction:ltr; display:inline-block;">${sup.empId}</b> 
                    لرفع ملفات مقاييسه بهذا المركز.
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0FBA50',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، اعتماد الحساب',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'جاري تسجيل واعتماد الحساب...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                const docKey = `${empId}_${encodeURIComponent(INSPECTOR_CENTER)}`;
                await db.collection("supervisor_accounts").doc(docKey).set({
                    empId: String(empId),
                    center: INSPECTOR_CENTER,
                    name: sup.name,
                    rank: sup.rank,
                    workplace: sup.workplace,
                    phone: sup.phone || "",
                    specs: sup.specs || [],
                    framingSpecs: sup.specs || [],
                    modules: sup.modules || [],
                    framingModules: sup.modules || [],
                    groups: sup.groups || [],
                    framingGroups: sup.groups || [],
                    supervisedRanks: sup.supervisedRanks || [],
                    framingRanks: sup.supervisedRanks || [],
                    s1: (typeof sup.s1 !== 'undefined') ? sup.s1 : true,
                    s2: (typeof sup.s2 !== 'undefined') ? sup.s2 : false,
                    s3: (typeof sup.s3 !== 'undefined') ? sup.s3 : false,
                    role: sup.role || "أستاذ مؤطر",
                    status: "active",
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvedBy: sessionStorage.getItem("userEmpId") || "INSPECTOR"
                }, { merge: true });

                Swal.fire({
                    icon: 'success',
                    title: 'تم اعتماد الحساب بنجاح',
                    text: `تم تسجيل وتفعيل حساب الأستاذ ${sup.name} بمركز ${INSPECTOR_CENTER}.`,
                    timer: 2000,
                    showConfirmButton: false
                });

            } catch (err) {
                console.error("خطأ في اعتماد الحساب:", err);
                Swal.fire('خطأ', 'تعذر حفظ الحساب في قاعدة البيانات، يرجى المحاولة لاحقاً.', 'error');
            }
        }
    });
};

// ================= تعطيل الحساب =================
window.disableSupervisorAccount = async function(empId) {
    const sup = supervisorsList.find(x => x.empId === empId);
    const docKey = `${empId}_${encodeURIComponent(INSPECTOR_CENTER)}`;

    Swal.fire({
        title: 'تعطيل حساب الأستاذ',
        text: `هل أنت متأكد من تعطيل حساب الأستاذ ${sup ? sup.name : empId}؟ لن يتمكن من تسجيل الدخول حتى تتم إعادة تفعيله.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e67e22',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، تعطيل الحساب',
        cancelButtonText: 'تراجع'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'جاري تعطيل الحساب...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                await db.collection("supervisor_accounts").doc(docKey).update({
                    status: "disabled",
                    disabledAt: firebase.firestore.FieldValue.serverTimestamp(),
                    disabledBy: sessionStorage.getItem("userEmpId") || "INSPECTOR"
                });

                Swal.fire({
                    icon: 'success',
                    title: 'تم تعطيل الحساب',
                    text: 'تم تعليق الحساب بنجاح.',
                    timer: 1800,
                    showConfirmButton: false
                });
            } catch (err) {
                console.error("خطأ في تعطيل الحساب:", err);
                Swal.fire('خطأ', 'حدث خطأ أثناء تعطيل الحساب.', 'error');
            }
        }
    });
};

// ================= إعادة تفعيل الحساب =================
window.enableSupervisorAccount = async function(empId) {
    const docKey = `${empId}_${encodeURIComponent(INSPECTOR_CENTER)}`;
    Swal.fire({ title: 'جاري تفعيل الحساب...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
        await db.collection("supervisor_accounts").doc(docKey).update({
            status: "active",
            reactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        Swal.fire({
            icon: 'success',
            title: 'تم التفعيل بنجاح',
            text: 'تمت استعادة نشاط الحساب.',
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.error("خطأ في التفعيل:", err);
        Swal.fire('خطأ', 'تعذر إعادة تفعيل الحساب.', 'error');
    }
};

// ================= حذف الحساب =================
window.deleteSupervisorAccount = async function(empId) {
    const sup = supervisorsList.find(x => x.empId === empId);
    const docKey = `${empId}_${encodeURIComponent(INSPECTOR_CENTER)}`;

    Swal.fire({
        title: 'تأكيد حذف الحساب',
        text: `هل أنت متأكد من حذف حساب الأستاذ ${sup ? sup.name : empId} من قائمة الحسابات المعتمدة؟ سيعود إلى الحالة (غير معتمد).`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، احذف الحساب',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'جاري الحذف...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            try {
                await db.collection("supervisor_accounts").doc(docKey).delete();

                Swal.fire({
                    icon: 'success',
                    title: 'تم حذف الحساب بنجاح',
                    text: 'تمت إزالة الحساب من قاعدة بيانات الأساتذة المعتمدين.',
                    timer: 1800,
                    showConfirmButton: false
                });
            } catch (err) {
                console.error("خطأ في حذف الحساب:", err);
                Swal.fire('خطأ', 'حدث خطأ أثناء محاولة حذف الحساب.', 'error');
            }
        }
    });
};
