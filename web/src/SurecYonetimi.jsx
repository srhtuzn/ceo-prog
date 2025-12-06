import { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Steps,
  Button,
  Drawer,
  Typography,
  Tag,
  List,
  Empty,
  message,
  Divider,
} from "antd";
import {
  BookOutlined,
  CodeOutlined,
  TeamOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  TrophyOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;
const API_URL = "http://localhost:3000";

// İkon eşleştirme
const IKONLAR = {
  CodeOutlined: <CodeOutlined />,
  TeamOutlined: <TeamOutlined />,
  RocketOutlined: <RocketOutlined />,
};

export default function SurecYonetimi() {
  const [katalog, setKatalog] = useState([]);
  const [seciliSurec, setSeciliSurec] = useState(null); // Detayı açılan süreç
  const [adimlar, setAdimlar] = useState([]);
  const [drawerAcik, setDrawerAcik] = useState(false);
  const [seciliAdim, setSeciliAdim] = useState(null); // Tıklanan adım detayı

  useEffect(() => {
    katalogCek();
  }, []);

  const katalogCek = () => {
    fetch(`${API_URL}/surecler/katalog`)
      .then((res) => res.json())
      .then(setKatalog);
  };

  const demoOlustur = () => {
    fetch(`${API_URL}/surecler/demo-olustur`, { method: "POST" })
      .then((res) => res.json())
      .then(() => {
        message.success("Demo veriler yüklendi!");
        katalogCek();
      });
  };

  const surecDetayAc = (surecId) => {
    fetch(`${API_URL}/surecler/detay/${surecId}`)
      .then((res) => res.json())
      .then((data) => {
        setSeciliSurec(data.bilgi);
        setAdimlar(data.adimlar);
        setDrawerAcik(true);
      });
  };

  // Adıma tıklandığında detay göster (Drawer içinde Modal veya genişleyen alan)
  // Ant Design Steps bileşeninde onChange ile yönetebiliriz.
  const adimDegisti = (current) => {
    const adim = adimlar[current];
    setSeciliAdim(adim);
  };

  return (
    <div>
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Title level={3}>
          <BookOutlined /> Süreç Kütüphanesi
        </Title>
        <Button onClick={demoOlustur} type="dashed">
          Demo Veri Yükle 🪄
        </Button>
      </div>

      {/* KATALOG GÖRÜNÜMÜ */}
      {katalog.map((kategori) => (
        <div key={kategori.id} style={{ marginBottom: 30 }}>
          <Title
            level={4}
            style={{
              borderLeft: `4px solid ${kategori.renk}`,
              paddingLeft: 10,
            }}
          >
            {IKONLAR[kategori.ikon]} {kategori.ad}
          </Title>
          <Row gutter={[16, 16]}>
            {kategori.surecler.length > 0 ? (
              kategori.surecler.map((surec) => (
                <Col span={8} key={surec.id}>
                  <Card
                    hoverable
                    onClick={() => surecDetayAc(surec.id)}
                    style={{
                      cursor: "pointer",
                      borderTop: `3px solid ${kategori.renk}`,
                    }}
                  >
                    <Title level={5}>{surec.baslik}</Title>
                    <Paragraph ellipsis={{ rows: 2 }} type="secondary">
                      {surec.aciklama}
                    </Paragraph>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 15,
                      }}
                    >
                      <Tag color="blue">
                        <ClockCircleOutlined /> {surec.tahmini_sure}
                      </Tag>
                      <Tag
                        color={
                          surec.zorluk_seviyesi === "Zor" ? "red" : "green"
                        }
                      >
                        <TrophyOutlined /> {surec.zorluk_seviyesi}
                      </Tag>
                    </div>
                  </Card>
                </Col>
              ))
            ) : (
              <Col span={24}>
                <Empty description="Bu kategoride süreç yok" />
              </Col>
            )}
          </Row>
        </div>
      ))}

      {/* SÜREÇ DETAY DRAWER (ROADMAP) */}
      <Drawer
        title={seciliSurec?.baslik}
        width={720}
        onClose={() => {
          setDrawerAcik(false);
          setSeciliAdim(null);
        }}
        open={drawerAcik}
        styles={{ body: { paddingBottom: 80 } }}
      >
        {seciliSurec && (
          <>
            <div
              style={{
                background: "#f5f5f5",
                padding: 15,
                borderRadius: 8,
                marginBottom: 20,
              }}
            >
              <Text type="secondary">{seciliSurec.aciklama}</Text>
            </div>

            <Title level={5}>Süreç Adımları (Yol Haritası)</Title>
            <Steps
              direction="vertical"
              current={-1} // Hiçbiri tamamlanmış değil, hepsi bilgi amaçlı
              onChange={adimDegisti}
              items={adimlar.map((adim) => ({
                title: adim.baslik,
                description: "Detay için tıkla",
                status: "process", // Hepsini aktif göster
                icon: <PlayCircleOutlined />,
              }))}
            />

            {/* SEÇİLİ ADIM DETAYI */}
            {seciliAdim && (
              <Card
                title={
                  <>
                    <FileTextOutlined /> Adım Detayı: {seciliAdim.baslik}
                  </>
                }
                style={{ marginTop: 20, borderColor: "#1890ff" }}
                headStyle={{ backgroundColor: "#e6f7ff", color: "#1890ff" }}
              >
                <Paragraph>{seciliAdim.detay_aciklama}</Paragraph>
                <Divider />
                <p>
                  <strong>Sorumlu Rol:</strong>{" "}
                  <Tag color="purple">{seciliAdim.sorumlu_rol}</Tag>
                </p>
                {seciliAdim.video_url && (
                  <Button
                    type="link"
                    href={seciliAdim.video_url}
                    target="_blank"
                  >
                    Eğitim Videosunu İzle
                  </Button>
                )}
              </Card>
            )}

            {/* FOOTER ACTION */}
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: "100%",
                borderTop: "1px solid #e9e9e9",
                padding: "10px 16px",
                background: "#fff",
                textAlign: "right",
              }}
            >
              <Button
                onClick={() => setDrawerAcik(false)}
                style={{ marginRight: 8 }}
              >
                Kapat
              </Button>
              <Button
                type="primary"
                onClick={() =>
                  message.info("Bu özelliği Görev Yönetimine bağlayacağız!")
                }
              >
                Bu Süreci Başlat (Görev Oluştur)
              </Button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
