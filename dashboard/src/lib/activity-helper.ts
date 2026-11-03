import { 
  Heart, 
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
  Send 
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

  // 1. Pesan Love Mail Diterima / Dikirim
  if (type === 'message_received' || type === 'love_mail' || meta.message_id) {
    const textPreview = meta.body || meta.text;
    return {
      title: 'Menerima Pesan Love Mail',
      description: textPreview 
        ? `Surat cinta berhasil diterima dan ditampilkan di layar OLED MewBot.`
        : meta.length 
          ? `Surat cinta (${meta.length} karakter) berhasil diterima dan ditampilkan di layar OLED.`
          : 'Pesan Love Mail berhasil dikirim dan ditampilkan di layar MewBot.',
      previewQuote: textPreview ? `“${textPreview}”` : null,
      icon: Heart,
      iconBg: 'bg-rose-50 border-rose-200',
      iconColor: 'text-rose-600',
      badge: 'Love Mail',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
    };
  }

  // 2. Mode Change / Alarm / Restart
  if (type === 'mode_change') {
    // A. Restart Request
    if (meta.action === 'restart_requested' || meta.reason) {
      return {
        title: 'Meminta Restart Perangkat',
        description: meta.reason 
          ? `Perintah reboot dikirim ke MewBot (${meta.reason}). Perangkat akan memulai ulang saat polling.`
          : 'Perintah reboot dikirim ke MewBot melalui dashboard.',
        previewQuote: null,
        icon: RotateCcw,
        iconBg: 'bg-orange-50 border-orange-200',
        iconColor: 'text-orange-600',
        badge: 'Restart',
        badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
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
        iconBg: 'bg-slate-50 border-slate-200',
        iconColor: 'text-slate-600',
        badge: 'Alarm Mati',
        badgeColor: 'bg-slate-50 text-slate-700 border-slate-200'
      };
    }

    if (meta.action === 'set_alarm' || meta.alarm_enabled === true) {
      return {
        title: 'Alarm Harian Diaktifkan',
        description: `Alarm berhasil disetel pada pukul ${meta.time || '07:00'} WIB. MewBot akan memainkan melodi pengingat.`,
        previewQuote: null,
        icon: Bell,
        iconBg: 'bg-amber-50 border-amber-200',
        iconColor: 'text-amber-600',
        badge: `Alarm ${meta.time || '07:00'}`,
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
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
        iconBg: isClock ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200',
        iconColor: isClock ? 'text-blue-600' : 'text-emerald-600',
        badge: isClock ? 'Mode Jam' : 'Mode Kodok',
        badgeColor: isClock ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }

    return {
      title: 'Pengaturan Mode Diperbarui',
      description: 'Konfigurasi mode perangkat berhasil disimpan dan disinkronkan.',
      previewQuote: null,
      icon: Sliders,
      iconBg: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      badge: 'Pengaturan',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
    };
  }

  // 3. Status Online
  if (type === 'online') {
    return {
      title: 'MewBot Online & Terhubung',
      description: 'MewBot aktif dan terhubung stabil ke cloud gateway.',
      previewQuote: null,
      icon: Wifi,
      iconBg: 'bg-emerald-50 border-emerald-200',
      iconColor: 'text-emerald-600',
      badge: 'Online',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }

  // 4. Status Offline
  if (type === 'offline') {
    return {
      title: 'MewBot Terputus (Offline)',
      description: 'MewBot tidak mengirim sinyal heartbeat selama lebih dari 30 detik.',
      previewQuote: null,
      icon: WifiOff,
      iconBg: 'bg-slate-50 border-slate-200',
      iconColor: 'text-slate-500',
      badge: 'Offline',
      badgeColor: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  }

  // 5. Sentuhan Kepala
  if (type === 'touch_interaction') {
    return {
      title: 'Sentuhan Kepala Terdeteksi',
      description: 'Sensor sentuh mendeteksi sentuhan kepala! MewBot melompat gembira dengan suara croak.',
      previewQuote: null,
      icon: Sparkles,
      iconBg: 'bg-teal-50 border-teal-200',
      iconColor: 'text-teal-600',
      badge: 'Reaksi Sentuh',
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200'
    };
  }

  // 6. Alarm Berdering
  if (type === 'alarm_triggered') {
    return {
      title: 'Alarm MewBot Berdering',
      description: `Alarm pagi berbunyi di perangkat pada waktu yang dijadwalkan.`,
      previewQuote: null,
      icon: Bell,
      iconBg: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
      badge: 'Alarm Bunyi',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    };
  }

  // 7. Reconnect Wi-Fi
  if (type === 'wifi_reconnect') {
    return {
      title: 'Menyambung Ulang Wi-Fi',
      description: 'MewBot berhasil menyambung kembali ke jaringan Wi-Fi secara otomatis.',
      previewQuote: null,
      icon: Wifi,
      iconBg: 'bg-blue-50 border-blue-200',
      iconColor: 'text-blue-600',
      badge: 'Wi-Fi',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
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
    iconBg: 'bg-[#f6f3eb] border-[#eae4d5]',
    iconColor: 'text-[#5e6b5f]',
    badge: 'Aktivitas',
    badgeColor: 'bg-[#f6f3eb] text-[#5e6b5f] border-[#eae4d5]'
  };
}

