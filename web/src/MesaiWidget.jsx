import { useState, useEffect, useRef } from "react";
import {
  Button,
  Popover,
  Statistic,
  Tag,
  message,
  Badge,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  CoffeeOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

const API_URL = "http://localhost:3000";
const { Text } = Typography;

export default function MesaiWidget({ aktifKullanici }) {
  const [acik, setAcik] = useState(false);
  const [iceride, setIceride] = useState(false);
  const [baslangicZamani, setBaslangicZamani] = useState(null);
  const [gecenSure, setGecenSure] = useState("00:00:00");
  const [loading, setLoading] = useState(false);

  const timerRef = useRef(null);

  // --- YARDIMCI: GÜVENLİ FETCH ---
  const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem("wf_token");
    if (!token) return null; // Token yoksa sessizce çık veya login'e at

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`, // Anahtar
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      // Token geçersizse oturumu kapat
      localStorage.removeItem("wf_user");
      localStorage.removeItem("wf_token");
      window.location.reload();
      throw new Error("Yetkisiz Erişim");
    }

    return res;
  };

  // --- 1. DURUM KONTROL & EVENT DİNLEME ---
  useEffect(() => {
    if (!aktifKullanici) return;

    // Widget açıldığında veya global event geldiğinde çalışır
    const durumGuncelle = () => {
      durumKontrol();
    };

    durumGuncelle();

    // Diğer sayfalardan (MesaiTakip.jsx) gelen değişiklikleri dinle
    const handleMesaiDegisti = (e) => {
      if (e.detail?.userId && e.detail.userId === aktifKullanici.id) {
        durumGuncelle();
      }
    };

    window.addEventListener("mesaiDegisti", handleMesaiDegisti);

    return () => {
      window.removeEventListener("mesaiDegisti", handleMesaiDegisti);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [aktifKullanici?.id]);

  // --- 2. SAYAÇ MANTIĞI ---
  useEffect(() => {
    if (iceride && baslangicZamani) {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        const simdi = dayjs();
        const baslama = dayjs(baslangicZamani);
        const fark = simdi.diff(baslama);
        const sure = dayjs.duration(fark);

        const saat = String(Math.floor(sure.asHours())).padStart(2, "0");
        const dakika = String(sure.minutes()).padStart(2, "0");
        const saniye = String(sure.seconds()).padStart(2, "0");

        setGecenSure(`${saat}:${dakika}:${saniye}`);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setGecenSure("00:00:00");
    }
    return () => clearInterval(timerRef.current);
  }, [iceride, baslangicZamani]);

  // --- 3. API İŞLEMLERİ ---
  const durumKontrol = async () => {
    try {
      // URL'den userId parametresi SİLİNDİ (Token'dan alıyor)
      const res = await authFetch(`${API_URL}/mesai/durum`);
      if (!res) return;

      const data = await res.json();
      if (data.iceride) {
        setIceride(true);
        setBaslangicZamani(data.kayit.baslangic);
      } else {
        setIceride(false);
        setBaslangicZamani(null);
      }
    } catch (error) {
      console.error("Widget durum hatası:", error);
    }
  };

  const islemYap = async (tip) => {
    setLoading(true);
    const endpoint = tip === "giris" ? "/mesai/giris" : "/mesai/cikis";
    const method = tip === "giris" ? "POST" : "PUT";

    try {
      // Body'den userId SİLİNDİ
      const res = await authFetch(`${API_URL}${endpoint}`, {
        method,
        body: JSON.stringify({
          aciklama: "Hızlı Widget İşlemi",
        }),
      });

      if (res && res.ok) {
        const data = await res.json();
        if (tip === "giris") {
          message.success("Mesai Başlatıldı! Kolay gelsin.");
          setBaslangicZamani(data.baslangic);
          setIceride(true);
        } else {
          message.success("Mesai Bitirildi. İyi dinlenmeler!");
          setIceride(false);
          setBaslangicZamani(null);
          setAcik(false); // İşlem bitince popover'ı kapat
        }

        // Global event fırlat (MesaiTakip sayfasını güncellemek için)
        window.dispatchEvent(
          new CustomEvent("mesaiDegisti", {
            detail: { userId: aktifKullanici.id },
          })
        );
      } else {
        message.error("İşlem başarısız oldu.");
      }
    } catch (error) {
      message.error("Sunucu hatası.");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div style={{ width: 280, textAlign: "center" }}>
      <div style={{ marginBottom: 15 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          BUGÜNKÜ DURUM
        </Text>
        <div style={{ marginTop: 5 }}>
          {iceride ? (
            <Tag
              color="processing"
              icon={<SyncOutlined spin />}
              style={{ padding: "5px 15px", fontSize: 14 }}
            >
              ÇALIŞIYOR
            </Tag>
          ) : (
            <Tag
              color="default"
              icon={<CoffeeOutlined />}
              style={{ padding: "5px 15px", fontSize: 14 }}
            >
              MESAİDE DEĞİL
            </Tag>
          )}
        </div>
      </div>

      <div
        style={{
          background: "#f5f5f5",
          padding: 15,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <Statistic
          title={iceride ? "Aktif Çalışma Süresi" : "Bugün"}
          value={gecenSure}
          valueStyle={{
            color: iceride ? "#3f8600" : "#999",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: "24px",
          }}
        />
      </div>

      {!iceride ? (
        <Button
          type="primary"
          block
          size="large"
          icon={<PlayCircleOutlined />}
          loading={loading}
          onClick={() => islemYap("giris")}
          style={{
            backgroundColor: "#52c41a",
            borderColor: "#52c41a",
            height: 45,
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          MESAİYE BAŞLA
        </Button>
      ) : (
        <Button
          type="primary"
          danger
          block
          size="large"
          icon={<PauseCircleOutlined />}
          loading={loading}
          onClick={() => islemYap("cikis")}
          style={{
            height: 45,
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          MESAİYİ BİTİR
        </Button>
      )}

      {iceride && baslangicZamani && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#888" }}>
          Giriş: {dayjs(baslangicZamani).format("HH:mm")}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title={null}
      trigger="click"
      open={acik}
      onOpenChange={setAcik}
      placement="bottomRight"
      arrow={false}
    >
      <div
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          height: "100%",
          padding: "0 15px",
          borderLeft: "1px solid #f0f0f0", // Ayırıcı çizgi eklendi
        }}
      >
        <Badge dot={iceride} color="green" offset={[-5, 5]}>
          <Button
            shape="circle"
            size="large"
            icon={
              <ClockCircleOutlined
                style={{
                  color: iceride ? "#52c41a" : undefined,
                  fontSize: "18px",
                }}
              />
            }
            style={{
              border: iceride ? "1px solid #b7eb8f" : "1px solid #d9d9d9",
              backgroundColor: iceride ? "#f6ffed" : "white",
            }}
          />
        </Badge>
      </div>
    </Popover>
  );
}
