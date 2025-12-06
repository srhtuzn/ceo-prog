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
  SyncOutlined, // <-- IMPORT BURAYA EKLENDİ
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

  useEffect(() => {
    if (aktifKullanici) {
      durumKontrol();
    }
    return () => clearInterval(timerRef.current);
  }, [aktifKullanici]);

  // Sayaç Mantığı
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
  }, [iceride, baslangicZamani]);

  const durumKontrol = async () => {
    try {
      const res = await fetch(
        `${API_URL}/mesai/durum?userId=${aktifKullanici.id}`
      );
      const data = await res.json();
      if (data.iceride) {
        setIceride(true);
        setBaslangicZamani(data.kayit.baslangic);
      } else {
        setIceride(false);
        setBaslangicZamani(null);
      }
    } catch (error) {
      console.error("Mesai durumu alınamadı", error);
    }
  };

  const islemYap = async (tip) => {
    setLoading(true);
    const endpoint = tip === "giris" ? "/mesai/giris" : "/mesai/cikis";
    const method = tip === "giris" ? "POST" : "PUT";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: aktifKullanici.id,
          aciklama: "Hızlı Widget İşlemi",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (tip === "giris") {
          message.success("Mesai Başlatıldı! Kolay gelsin. 🚀");
          setBaslangicZamani(data.baslangic);
          setIceride(true);
        } else {
          message.success("Mesai Bitirildi. İyi dinlenmeler! 🏠");
          setIceride(false);
          setBaslangicZamani(null);
          setAcik(false);
        }
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
        <div>
          {iceride ? (
            <Tag
              color="processing"
              icon={<SyncOutlined spin />}
              style={{ padding: "5px 10px", marginTop: 5, fontSize: 14 }}
            >
              ÇALIŞIYOR
            </Tag>
          ) : (
            <Tag
              color="default"
              icon={<CoffeeOutlined />}
              style={{ padding: "5px 10px", marginTop: 5, fontSize: 14 }}
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
            height: 50,
            fontSize: 16,
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
          style={{ height: 50, fontSize: 16 }}
        >
          MESAİYİ BİTİR
        </Button>
      )}

      {iceride && (
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
    >
      <div
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          height: "100%",
          padding: "0 10px",
        }}
      >
        <Badge dot={iceride} color="green" offset={[-2, 2]}>
          <Button
            shape="circle"
            icon={
              <ClockCircleOutlined
                style={{ color: iceride ? "#52c41a" : undefined }}
              />
            }
            style={{
              border: iceride ? "1px solid #b7eb8f" : undefined,
              backgroundColor: iceride ? "#f6ffed" : undefined,
            }}
          />
        </Badge>
      </div>
    </Popover>
  );
}
