import { 
  Clock, 
  Bell, 
  BellOff, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Sparkles, 
  Smile, 
  Activity, 
  Sliders, 
  Send,
  Trash2,
  XCircle,
  Download,
  CheckCircle2,
  AlertTriangle,
  Inbox
} from 'lucide-react';

export interface HumanActivity {
  title: string;
  description: string;
  previewQuote?: string | null;
  icon: any;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeColor: string;
}

export function formatActivityEvent(item: any): HumanActivity {
  const meta = item.metadata || {};
  const type = item.event_type;

  // 1. Pesan Diterima / Dikirim
  // Catatan: tipe event 'love_mail' dipertahankan karena data historis di database
  // memakainya; hanya teks yang ditampilkan yang dinetralkan.
  if (type === 'message_received' || type === 'love_mail' || meta.message_id) {
    const textPreview = meta.body || meta.text;
    return {
      title: 'Menerima Pesan',
      description: textPreview
        ? `Pesan berhasil diterima dan ditampilkan di layar OLED MewBot.`
        : meta.length
          ? `Pesan (${meta.length} karakter) berhasil diterima dan ditampilkan di layar OLED.`
          : 'Pesan berhasil dikirim dan ditampilkan di layar MewBot.',
      previewQuote: textPreview ? `“${textPreview}”` : null,
      icon: Inbox,
      iconBg: 'bg-[var(--olive-subtle)] border-[var(--border-chip)]',
      iconColor: 'text-[var(--olive-primary)]',
      badge: 'Pesan',
      badgeColor: 'bg-[var(--olive-subtle)] text-[var(--olive-deep)] border-[var(--border-chip)]'
    };
  }

  // 2. Mode Change / Alarm / Restart / Cancellation
  if (type === 'mode_change') {
    // A-OTA. Permintaan Update Firmware Dijadwalkan
    if (meta.action === 'firmware_update_requested') {
      return {
        title: 'Menjadwalkan Update Firmware',
        description: meta.version
          ? `Perintah update ke firmware v${meta.version} masuk antrean polling. Perangkat akan mengunduh saat online.`
          : 'Perintah update firmware masuk antrean polling. Perangkat akan mengunduh saat online.',
        previewQuote: null,
        icon: Download,
        iconBg: 'bg-[var(--purple-50)] border-[var(--purple-200)]',
        iconColor: 'text-[var(--purple-600)]',
        badge: 'Firmware',
        badgeColor: 'bg-[var(--purple-50)] text-[var(--purple-700)] border-[var(--purple-200)]'
      };
    }

    // A-OTA. Update Firmware Berhasil
    if (meta.action === 'firmware_update_applied') {
      return {
        title: 'Firmware Diperbarui',
        description: 'Perangkat selesai mengunduh, memverifikasi SHA-256, dan berpindah ke slot firmware baru.',
        previewQuote: null,
        icon: CheckCircle2,
        iconBg: 'bg-[var(--emerald-50)] border-[var(--emerald-200)]',
        iconColor: 'text-[var(--emerald-600)]',
        badge: 'Berhasil',
        badgeColor: 'bg-[var(--emerald-50)] text-[var(--emerald-700)] border-[var(--emerald-200)]'
      };
    }

    // A-OTA. Update Firmware Gagal
    if (meta.action === 'firmware_update_failed') {
      return {
        title: 'Update Firmware Gagal',
        description: meta.error
          ? `Perangkat tetap memakai firmware lama. Alasan: ${meta.error}`
          : 'Perangkat tetap memakai firmware lama karena update tidak selesai.',
        previewQuote: null,
        icon: AlertTriangle,
        iconBg: 'bg-[var(--red-50)] border-[var(--red-200)]',
        iconColor: 'text-[var(--red-600)]',
        badge: 'Gagal',
        badgeColor: 'bg-[var(--red-50)] text-[var(--red-700)] border-[var(--red-200)]'
      };
    }

    // A0. Message Cancelled from Polling Queue
    if (meta.action === 'message_cancelled') {
      return {
        title: 'Membatalkan Pesan dari Polling',
        description: meta.cancelled_body
          ? `Pesan "${meta.cancelled_body}" telah ditarik dan dibatalkan sebelum dibaca oleh perangkat.`
          : 'Pesan berhasil ditarik dan dihapus dari antrean polling.',
        previewQuote: null,
        icon: Trash2,
        iconBg: 'bg-[var(--red-50)] border-[var(--red-200)]',
        iconColor: 'text-[var(--red-600)]',
        badge: 'Dibatalkan',
        badgeColor: 'bg-[var(--red-50)] text-[var(--red-700)] border-[var(--red-200)]'
      };
    }

    // A1. Command Cancelled
    if (meta.action === 'command_cancelled') {
      return {
        title: 'Membatalkan Perintah Polling',
        description: `Perintah remote (${meta.command_type || 'perangkat'}) berhasil dibatalkan dari antrean polling.`,
        previewQuote: null,
        icon: XCircle,
        iconBg: 'bg-[var(--slate-50)] border-[var(--slate-200)]',
        iconColor: 'text-[var(--slate-600)]',
        badge: 'Dibatalkan',
        badgeColor: 'bg-[var(--slate-50)] text-[var(--slate-700)] border-[var(--slate-200)]'
      };
    }

    // A. Restart Request
    if (meta.action === 'restart_requested' || meta.reason) {
      return {
        title: 'Meminta Restart Perangkat',
        description: meta.reason 
          ? `Perintah reboot dikirim ke MewBot (${meta.reason}). Perangkat akan memulai ulang saat polling.`
          : 'Perintah reboot dikirim ke MewBot melalui dashboard.',
        previewQuote: null,
        icon: RotateCcw,
        iconBg: 'bg-[var(--orange-50)] border-[var(--orange-200)]',
        iconColor: 'text-[var(--orange-600)]',
        badge: 'Restart',
        badgeColor: 'bg-[var(--orange-50)] text-[var(--orange-700)] border-[var(--orange-200)]'
      };
    }

    // B. Alarm Configured / Deleted
    if (meta.action === 'delete_alarm' || meta.alarm_enabled === false) {
      return {
        title: 'Alarm Dihapus / Dinonaktifkan',
        description: meta.time 
          ? `Jadwal alarm pada pukul ${meta.time} WIB telah dibatalkan / dihapus.`
          : 'Alarm harian telah dimatikan dan tidak akan berdering.',
        previewQuote: null,
        icon: BellOff,
        iconBg: 'bg-[var(--slate-50)] border-[var(--slate-200)]',
        iconColor: 'text-[var(--slate-600)]',
        badge: 'Alarm Mati',
        badgeColor: 'bg-[var(--slate-50)] text-[var(--slate-700)] border-[var(--slate-200)]'
      };
    }

    if (meta.action === 'set_alarm' || meta.alarm_enabled === true) {
      return {
        title: 'Alarm Harian Diaktifkan',
        description: `Alarm berhasil disetel pada pukul ${meta.time || '07:00'} WIB. MewBot akan memainkan melodi pengingat.`,
        previewQuote: null,
        icon: Bell,
        iconBg: 'bg-[var(--amber-50)] border-[var(--amber-200)]',
        iconColor: 'text-[var(--amber-600)]',
        badge: `Alarm ${meta.time || '07:00'}`,
        badgeColor: 'bg-[var(--amber-50)] text-[var(--amber-700)] border-[var(--amber-200)]'
      };
    }

    // C. Mode Switch (PET vs CLOCK)
    if (meta.new_mode) {
      const isClock = meta.new_mode === 'CLOCK';
      return {
        title: isClock ? 'Beralih ke Mode Jam Modern' : 'Beralih ke Mode Karakter Kodok',
        description: isClock 
          ? 'Tampilan MewBot beralih ke Jam Digital WIB lengkap dengan kalender dan status baterai.'
          : 'Tampilan MewBot beralih ke Karakter Animasi Kodok (Frog Pet) yang interaktif.',
        previewQuote: null,
        icon: isClock ? Clock : Smile,
        iconBg: isClock ? 'bg-[var(--blue-50)] border-[var(--blue-200)]' : 'bg-[var(--emerald-50)] border-[var(--emerald-200)]',
        iconColor: isClock ? 'text-[var(--blue-600)]' : 'text-[var(--emerald-600)]',
        badge: isClock ? 'Mode Jam' : 'Mode Kodok',
        badgeColor: isClock ? 'bg-[var(--blue-50)] text-[var(--blue-700)] border-[var(--blue-200)]' : 'bg-[var(--emerald-50)] text-[var(--emerald-700)] border-[var(--emerald-200)]'
      };
    }

    return {
      title: 'Pengaturan Mode Diperbarui',
      description: 'Konfigurasi mode perangkat berhasil disimpan dan disinkronkan.',
      previewQuote: null,
      icon: Sliders,
      iconBg: 'bg-[var(--blue-50)] border-[var(--blue-200)]',
      iconColor: 'text-[var(--blue-600)]',
      badge: 'Pengaturan',
      badgeColor: 'bg-[var(--blue-50)] text-[var(--blue-700)] border-[var(--blue-200)]'
    };
  }

  // 3. Status Online
  if (type === 'online') {
    return {
      title: 'MewBot Online & Terhubung',
      description: 'MewBot aktif dan terhubung stabil ke cloud gateway.',
      previewQuote: null,
      icon: Wifi,
      iconBg: 'bg-[var(--emerald-50)] border-[var(--emerald-200)]',
      iconColor: 'text-[var(--emerald-600)]',
      badge: 'Online',
      badgeColor: 'bg-[var(--emerald-50)] text-[var(--emerald-700)] border-[var(--emerald-200)]'
    };
  }

  // 4. Status Offline
  if (type === 'offline') {
    return {
      title: 'MewBot Terputus (Offline)',
      description: 'MewBot tidak mengirim sinyal heartbeat selama lebih dari 30 detik.',
      previewQuote: null,
      icon: WifiOff,
      iconBg: 'bg-[var(--slate-50)] border-[var(--slate-200)]',
      iconColor: 'text-[var(--slate-500)]',
      badge: 'Offline',
      badgeColor: 'bg-[var(--slate-50)] text-[var(--slate-700)] border-[var(--slate-200)]'
    };
  }

  // 5. Sentuhan Kepala
  if (type === 'touch_interaction') {
    return {
      title: 'Sentuhan Kepala Terdeteksi',
      description: 'Sensor sentuh mendeteksi sentuhan kepala! MewBot melompat gembira dengan suara croak.',
      previewQuote: null,
      icon: Sparkles,
      iconBg: 'bg-[var(--teal-50)] border-[var(--teal-200)]',
      iconColor: 'text-[var(--teal-600)]',
      badge: 'Reaksi Sentuh',
      badgeColor: 'bg-[var(--teal-50)] text-[var(--teal-700)] border-[var(--teal-200)]'
    };
  }

  // 6. Alarm Berdering
  if (type === 'alarm_triggered') {
    return {
      title: 'Alarm MewBot Berdering',
      description: `Alarm pagi berbunyi di perangkat pada waktu yang dijadwalkan.`,
      previewQuote: null,
      icon: Bell,
      iconBg: 'bg-[var(--amber-50)] border-[var(--amber-200)]',
      iconColor: 'text-[var(--amber-600)]',
      badge: 'Alarm Bunyi',
      badgeColor: 'bg-[var(--amber-50)] text-[var(--amber-700)] border-[var(--amber-200)]'
    };
  }

  // 7. Reconnect Wi-Fi
  if (type === 'wifi_reconnect') {
    return {
      title: 'Menyambung Ulang Wi-Fi',
      description: 'MewBot berhasil menyambung kembali ke jaringan Wi-Fi secara otomatis.',
      previewQuote: null,
      icon: Wifi,
      iconBg: 'bg-[var(--blue-50)] border-[var(--blue-200)]',
      iconColor: 'text-[var(--blue-600)]',
      badge: 'Wi-Fi',
      badgeColor: 'bg-[var(--blue-50)] text-[var(--blue-700)] border-[var(--blue-200)]'
    };
  }

  // Fallback
  const cleanTitle = type
    ? type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : 'Aktivitas MewBot';

  return {
    title: cleanTitle,
    description: 'Catatan aktivitas sistem perangkat.',
    previewQuote: null,
    icon: Activity,
    iconBg: 'bg-[var(--bg-surface-subtle)] border-[var(--border-subtle)]',
    iconColor: 'text-[var(--text-muted)]',
    badge: 'Aktivitas',
    badgeColor: 'bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border-[var(--border-subtle)]'
  };
}

