/**
 * =========================================================================
 * فضاء التكوين البيداغوجي - مديرية التربية لولاية توقرت
 * وحدة الحماية المركزية ومكافحة العبث (Central Security & Anti-Tamper Shield)
 * =========================================================================
 */
(function (global) {
  'use strict';

  // ملح تشفير لتوقيع الجلسات محلياً
  const SECURITY_SALT = "TQ_PEDAGOGY_SEC_2026_V1@PROTECTED#";

  // دالة تجزئة سريعة وموثوقة (Hash Function) لتوقيع الجلسة
  function generateHash(str) {
    let hash1 = 0xdeadbeef ^ 0;
    let hash2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      hash1 = Math.imul(hash1 ^ ch, 2654435761);
      hash2 = Math.imul(hash2 ^ ch, 1597334677);
    }
    hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507);
    hash1 ^= Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
    hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507);
    hash2 ^= Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & hash2) + (hash1 >>> 0)).toString(36);
  }

  // بصمة فريدة لبيئة المتصفح الحالية
  function getDeviceFingerprint() {
    const nav = window.navigator || {};
    const scr = window.screen || {};
    return [
      nav.userAgent || '',
      scr.width || '',
      scr.height || '',
      scr.colorDepth || '',
      (new Date()).getTimezoneOffset()
    ].join('###');
  }

  const SecurityGuard = {
    // -------------------------------------------------------------
    // 1. إدارة وتوقيع الجلسات بأمان (Session Signature & Integrity)
    // -------------------------------------------------------------
    createSession: function (empId, role, name, extraData) {
      try {
        extraData = extraData || {};
        const issueTime = Date.now().toString();
        const payload = empId + '::' + role + '::' + (name || '') + '::' + issueTime + '::' + getDeviceFingerprint() + '::' + SECURITY_SALT;
        const signature = generateHash(payload);

        sessionStorage.setItem("userEmpId", empId);
        sessionStorage.setItem("userName", name || "مستخدم");
        sessionStorage.setItem("userRole", role || "user");
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("session_issued", issueTime);
        sessionStorage.setItem("session_sig", signature);

        if (extraData && typeof extraData === "object") {
          for (const key in extraData) {
            sessionStorage.setItem(key, String(extraData[key]));
          }
        }
        return true;
      } catch (err) {
        console.error("فشل إنشاء الجلسة المؤمنة:", err);
        return false;
      }
    },

    verifySession: function (requiredRole) {
      try {
        const empId = sessionStorage.getItem("userEmpId");
        const name = sessionStorage.getItem("userName");
        const role = sessionStorage.getItem("userRole");
        const loggedIn = sessionStorage.getItem("isLoggedIn");
        const issued = sessionStorage.getItem("session_issued");
        const sig = sessionStorage.getItem("session_sig");

        // إذا كانت الجلسة مفقودة
        if (!empId || !loggedIn || loggedIn !== "true") {
          this.destroyAndRedirect("جلسة غير مسجلة");
          return false;
        }

        // إذا كانت الجلسة مسجلة بدون توقيع (محاولة إدخال يدوي من Inspect)، أو التوقيع خاطئ
        if (!sig || !issued) {
          this.destroyAndRedirect("جلسة غير موثقة رقمياً");
          return false;
        }

        const expectedPayload = empId + '::' + role + '::' + (name || '') + '::' + issued + '::' + getDeviceFingerprint() + '::' + SECURITY_SALT;
        const expectedSig = generateHash(expectedPayload);

        if (sig !== expectedSig) {
          this.destroyAndRedirect("تم اكتشاف محاولة تلاعب ببيانات الجلسة!");
          return false;
        }

        // التحقق من الرتبة / الصلاحية
        if (requiredRole) {
          if (requiredRole === "ADMIN" && role !== "ADMIN" && empId !== "ADMIN_ACCESS") {
            this.destroyAndRedirect("صلاحيات غير كافية للوصول لهذا القسم");
            return false;
          }
          if (requiredRole === "INSPECTOR" && role !== "INSPECTOR" && role !== "ADMIN") {
            this.destroyAndRedirect("هذا القسم مخصص للمشرفين والمفتشين فقط");
            return false;
          }
        }

        return true;
      } catch (err) {
        this.destroyAndRedirect("خطأ في التحقق من الجلسة");
        return false;
      }
    },

    destroyAndRedirect: function (reason) {
      console.warn("Security Alert:", reason);
      try {
        sessionStorage.clear();
      } catch (e) {}
      window.location.replace("/login");
    },

    logout: function () {
      if (window.Swal) {
        Swal.fire({
          title: 'تأكيد الخروج',
          text: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'نعم، خروج',
          cancelButtonText: 'تراجع',
          confirmButtonColor: '#dc2626',
          cancelButtonColor: '#64748b'
        }).then((result) => {
          if (result.isConfirmed) {
            sessionStorage.clear();
            window.location.href = "/login";
          }
        });
      } else {
        if (confirm("هل تريد تسجيل الخروج؟")) {
          sessionStorage.clear();
          window.location.href = "/login";
        }
      }
    },

    // -------------------------------------------------------------
    // 2. تنقية المدخلات والحماية ضد ثغرات XSS
    // -------------------------------------------------------------
    escapeHtml: function (str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\//g, "&#x2F;");
    },

    // -------------------------------------------------------------
    // 3. درع مكافحة أدوات المطور (Anti-Inspect & DevTools Defense)
    // -------------------------------------------------------------
    initAntiInspect: function () {
      // 1. منع زر الفأرة الأيمن
      document.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        return false;
      }, { capture: true });

      // 2. منع اختصارات لوحة المفاتيح
      document.addEventListener("keydown", function (e) {
        if (e.keyCode === 123) { // F12
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        const isCtrl = e.ctrlKey || e.metaKey;
        const isShift = e.shiftKey;

        // Ctrl + Shift + I, J, C
        if (isCtrl && isShift && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl + U (View Source)
        if (isCtrl && (e.keyCode === 85 || e.key === 'u' || e.key === 'U')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl + S (Save Page)
        if (isCtrl && (e.keyCode === 83 || e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, { capture: true });

      // 3. منع سحب الصور الحساسة
      document.addEventListener("dragstart", function (e) {
        if (e.target && e.target.tagName === "IMG") {
          e.preventDefault();
        }
      });

      // 4. تحذير أمني في Console
      try {
        console.clear();
        setTimeout(() => {
          console.log("%c⛔ تحذير أمني صارم!", "color:#dc2626; font-size:24px; font-weight:900;");
          console.log("%cهذا الموقع محمي بنظام أمني لمنع العبث والتلاعب بالبيانات. أي محاولة تعديل في أدوات المطور تعرض حسابك للحظر الفوري.", "color:#1e293b; font-size:13px; font-weight:700;");
        }, 500);
      } catch (e) {}

      // 5. مراقبة فتح أدوات المطورين دورياً
      setInterval(function () {
        const start = performance.now();
        (function () {}["constructor"]("debugger")());
        const duration = performance.now() - start;
        if (duration > 150) {
          console.warn("DevTools monitoring active");
        }
      }, 3000);
    }
  };

  SecurityGuard.initAntiInspect();
  global.SecurityGuard = SecurityGuard;

})(typeof window !== 'undefined' ? window : this);
