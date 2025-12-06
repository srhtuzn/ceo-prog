import { useState, useEffect, useRef } from "react";
import {
  Card,
  Button,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  message,
  Alert,
  Spin,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

const API_URL = "http://localhost:3000";

export default function MesaiTakip({ aktifKullanici }) {
  const [iceride, setIceride] = useState(false);
  const [gecmis, setGecmis] = useState([]);
  const [baslangicZamani, setBaslangicZamani] = useState(null);
  const [gecenSure, setGecenSure] = useState("00:00:00");
  const [yukleniyor, setYukleniyor] = useState(false);

  const timerRef = useRef(null);

  // Yönetici mi?
  const yoneticiMi = ["Genel Müdür", "İnsan Kaynakları", "Yönetim"].includes(
    aktifKullanici.rol
  );

  useEffect(() => {
    durumKontrol();
    gecmisCek();

    return () => clearInterval(timerRef.current);
  }, []);

  // Sayaç Mantığı
  useEffect(() => {
    if (iceride && baslangicZamani) {
      timerRef.current = setInterval(() => {
        const simdi = dayjs();
        const baslama = dayjs(baslangicZamani);
        const fark = simdi.diff(baslama); // Milisaniye
        const sure = dayjs.duration(fark);

        // Formatlama: HH:mm:ss
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

  const durumKontrol = async () => {
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
  };

  const gecmisCek = async () => {
    // Yönetici ise herkesi görsün, değilse sadece kendini (tumu=true/false)
    const url = `${API_URL}/mesai/gecmis?userId=${aktifKullanici.id}&tumu=${yoneticiMi}`;
    const res = await fetch(url);
    const data = await res.json();
    setGecmis(data);
  };

  const girisYap = async () => {
    setYukleniyor(true);
    const res = await fetch(`${API_URL}/mesai/giris`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: aktifKullanici.id,
        aciklama: "Web üzerinden giriş",
      }),
    });
    if (res.ok) {
      message.success("Mesai Başlatıldı! İyi çalışmalar ☕");
      const data = await res.json();
      setBaslangicZamani(data.baslangic);
      setIceride(true);
      gecmisCek();
    }
    setYukleniyor(false);
  };

  const cikisYap = async () => {
    setYukleniyor(true);
    const res = await fetch(`${API_URL}/mesai/cikis`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: aktifKullanici.id }),
    });
    if (res.ok) {
      message.success("Mesai Bitirildi. İyi dinlenmeler 🏠");
      setIceride(false);
      setBaslangicZamani(null);
      gecmisCek();
    }
    setYukleniyor(false);
  };

  const columns = [
    {
      title: "Personel",
      dataIndex: "ad_soyad",
      key: "ad_soyad",
      render: (t) => <b>{t}</b>,
    },
    {
      title: "Tarih",
      dataIndex: "tarih",
      render: (t) => dayjs(t).format("DD.MM.YYYY"),
    },
    {
      title: "Giriş",
      dataIndex: "baslangic",
      render: (t) => <Tag color="blue">{dayjs(t).format("HH:mm")}</Tag>,
    },
    {
      title: "Çıkış",
      dataIndex: "bitis",
      render: (t) =>
        t ? (
          <Tag color="orange">{dayjs(t).format("HH:mm")}</Tag>
        ) : (
          <Tag color="processing">İçeride</Tag>
        ),
    },
    {
      title: "Süre",
      dataIndex: "sure_dakika",
      render: (dk) => {
        const saat = Math.floor(dk / 60);
        const dakika = dk % 60;
        return dk > 0 ? `${saat}s ${dakika}dk` : "-";
      },
    },
    {
      title: "Durum",
      dataIndex: "mesai_turu",
      render: (t) =>
        t === "Fazla Mesai" ? (
          <Tag color="purple">Fazla Mesai</Tag>
        ) : (
          <Tag color="default">Normal</Tag>
        ),
    },
  ];

  // Sadece yönetici sütununda personeli gösterelim, personel kendi ekranında zaten biliyor
  const finalColumns = yoneticiMi
    ? columns
    : columns.filter((c) => c.dataIndex !== "ad_soyad");

  return (
    <div>
      {/* KONTROL PANELİ */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card
            bordered={false}
            style={{
              textAlign: "center",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <Statistic
              title="Şu Anki Durum"
              value={iceride ? "Çalışıyor" : "Mesaide Değil"}
              valueStyle={{ color: iceride ? "#3f8600" : "#cf1322" }}
              prefix={iceride ? <ClockCircleOutlined /> : <CalendarOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered={false} style={{ textAlign: "center" }}>
            <Statistic title="Geçen Süre (Bugün)" value={gecenSure} />
            <div style={{ marginTop: 15 }}>
              {!iceride ? (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={girisYap}
                  loading={yukleniyor}
                  style={{
                    backgroundColor: "#52c41a",
                    borderColor: "#52c41a",
                    width: "100%",
                  }}
                >
                  GÜNE BAŞLA
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={cikisYap}
                  loading={yukleniyor}
                  style={{ width: "100%" }}
                >
                  GÜNÜ BİTİR
                </Button>
              )}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card bordered={false}>
            <Alert
              message="Hatırlatma"
              description="Mesai giriş ve çıkışlarınızı zamanında yapmanız, maaş ve prim hesaplamaları için önemlidir."
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>

      {/* GEÇMİŞ LİSTESİ */}
      <Card
        title={
          <span>
            <HistoryOutlined /> Mesai Hareketleri (
            {yoneticiMi ? "Tüm Ekip" : "Geçmişim"})
          </span>
        }
      >
        <Table
          dataSource={gecmis}
          columns={finalColumns}
          rowKey="id"
          pagination={{ pageSize: 7 }}
        />
      </Card>
    </div>
  );
}
