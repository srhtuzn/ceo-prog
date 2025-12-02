import { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  List,
  Tag,
  Table,
  Modal,
  Space,
  Button,
  message,
} from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  AlertOutlined,
  ProjectOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";

export default function AdminDashboard() {
  const [veri, setVeri] = useState(null);

  // MODAL STATE'LERİ
  const [finansModal, setFinansModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [projeModal, setProjeModal] = useState(false);
  const [bekleyenPersonel, setBekleyenPersonel] = useState([]);
  const [personelModal, setPersonelModal] = useState(false);

  // DETAY VERİLERİ
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);

  // KULLANICIYI HAFIZADAN AL
  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  useEffect(() => {
    fetch(`${API_URL}/dashboard/ozet`)
      .then((res) => res.json())
      .then((data) => setVeri(data));

    bekleyenleriCek();
  }, []);

  // 1. FİNANS DETAYI (DÜZELTİLDİ: URL Güncellendi)
  const finansDetayGoster = () => {
    // ESKİ: /satin-alma -> YENİ: /finans
    fetch(`${API_URL}/finans?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        const bekleyenler = data.filter((d) => d.durum.includes("Bekliyor"));
        setFinansDetay(bekleyenler);
        setFinansModal(true);
      });
  };

  // 2. İZİN DETAYI (DÜZELTİLDİ: URL Güncellendi)
  const izinDetayGoster = () => {
    // ESKİ: /izinler -> YENİ: /ik/izinler
    fetch(`${API_URL}/ik/izinler?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        const bugun = dayjs().format("YYYY-MM-DD");

        const bugunYoklar = data.filter(
          (i) =>
            i.durum.includes("Onaylandı") &&
            bugun >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
            bugun <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
        );

        setIzinDetay(bugunYoklar);
        setIzinModal(true);
      });
  };

  // Bekleyen personelleri çek (DÜZELTİLDİ: URL Güncellendi)
  const bekleyenleriCek = () => {
    // ESKİ: /kullanicilar -> YENİ: /ik/kullanicilar
    fetch(`${API_URL}/ik/kullanicilar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Sadece 'Bekliyor' olanları filtrele
          setBekleyenPersonel(
            data.filter((u) => u.hesap_durumu === "Bekliyor")
          );
        }
      });
  };

  // Onaylama İşlemi
  const personelOnayla = (id, karar) => {
    fetch(`${API_URL}/auth/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: karar }),
    }).then(() => {
      message.success(`Personel ${karar} edildi.`);
      bekleyenleriCek(); // Listeyi yenile
    });
  };

  if (!veri) return <div style={{ padding: 20 }}>Yükleniyor...</div>;

  return (
    <div>
      {/* --- ÜST KARTLAR --- */}
      <Row gutter={[16, 16]}>
        {/* FİNANS KARTI */}
        <Col span={6}>
          <Card
            hoverable
            onClick={finansDetayGoster}
            style={{ cursor: "pointer", borderTop: "3px solid #faad14" }}
          >
            <Statistic
              title="Onay Bekleyen Ödeme"
              value={veri.bekleyenTalepler || 0} // Backend'den gelen anahtar ismine dikkat
              suffix=" Adet"
              prefix={<DollarOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Detay için tıklayın
            </div>
          </Card>
        </Col>

        {/* RİSKLİ İŞLER KARTI */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setRiskModal(true)}
            style={{ cursor: "pointer", borderTop: "3px solid #cf1322" }}
          >
            <Statistic
              title="Acil / Geciken İşler"
              value={veri.riskli_isler ? veri.riskli_isler.length : 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: "#cf1322" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Listeyi görmek için tıklayın
            </div>
          </Card>
        </Col>

        {/* İZİNLİLER KARTI */}
        <Col span={6}>
          <Card
            hoverable
            onClick={izinDetayGoster}
            style={{ cursor: "pointer", borderTop: "3px solid #1890ff" }}
          >
            <Statistic
              title="Bugün İzinli"
              value={veri.bugun_izinli || 0} // Eğer null gelirse 0 göster
              suffix="Kişi"
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Detaylar için tıklayın
            </div>
          </Card>
        </Col>

        {/* TAMAMLANMA KARTI */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setProjeModal(true)}
            style={{ cursor: "pointer", borderTop: "3px solid #52c41a" }}
          >
            <Statistic
              title="Toplam Tamamlanan İş"
              value={veri.toplamGorev || 0} // Backend'den gelen veriye göre uyarladım
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Proje bazlı detay
            </div>
          </Card>
        </Col>

        {/* PERSONEL ONAY KARTI (Ekstra olarak alta veya yana eklenebilir) */}
        <Col span={6}>
          <Card
            hoverable
            onClick={() => setPersonelModal(true)}
            style={{ cursor: "pointer", borderTop: "3px solid #722ed1" }}
          >
            <Statistic
              title="Personel Onayı Bekleyen"
              value={bekleyenPersonel.length}
              prefix={<UserAddOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Katılım istekleri
            </div>
          </Card>
        </Col>
      </Row>

      {/* --- GRAFİKLER BÖLÜMÜ --- */}
      <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
        <Col span={14}>
          <Card
            title={
              <span>
                <ProjectOutlined /> Görev Durumları
              </span>
            }
          >
            <List
              dataSource={veri.gorevDurumlari || []}
              renderItem={(item) => {
                // Basit bir liste gösterimi
                return (
                  <List.Item>
                    <div
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong>{item.durum}</strong>
                      <Tag color="blue">{item.count} Adet</Tag>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <span>
                <AlertOutlined /> Teslimi Yaklaşan Görevler
              </span>
            }
            style={{ height: "100%" }}
          >
            <List
              dataSource={veri.riskli_isler || []}
              renderItem={(item) => {
                const tarih = dayjs(item.tarih);
                const bugun = dayjs();
                const gecikmis = tarih.isBefore(bugun, "day");
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Tag color={gecikmis ? "red" : "orange"}>
                          {gecikmis ? "GECİKTİ" : "YAKLAŞIYOR"}
                        </Tag>
                      }
                      title={item.baslik}
                      description={
                        <div>
                          <div>{tarih.format("DD.MM.YYYY")}</div>
                          <div style={{ fontSize: 11 }}>
                            {item.atananlar?.join(", ")}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
            {(!veri.riskli_isler || veri.riskli_isler.length === 0) && (
              <div style={{ textAlign: "center", color: "green", padding: 20 }}>
                <CheckCircleOutlined /> Her şey yolunda!
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* --- MODALLAR --- */}

      {/* 1. FİNANS DETAYI */}
      <Modal
        title="Onay Bekleyen Ödemeler"
        open={finansModal}
        onCancel={() => setFinansModal(false)}
        footer={null}
        width={700}
      >
        <Table
          dataSource={finansDetay}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          columns={[
            { title: "Talep Eden", dataIndex: "talep_eden" },
            { title: "Başlık", dataIndex: "baslik" },
            {
              title: "Tutar",
              render: (_, r) => (
                <Tag color="gold">
                  {r.tutar} {r.para_birimi}
                </Tag>
              ),
            },
            {
              title: "Durum",
              dataIndex: "durum",
              render: (d) => <Tag>{d}</Tag>,
            },
          ]}
        />
      </Modal>

      {/* 2. RİSKLİ İŞLER DETAYI */}
      <Modal
        title="Acil & Geciken İşler"
        open={riskModal}
        onCancel={() => setRiskModal(false)}
        footer={null}
        width={700}
      >
        <Table
          dataSource={veri.riskli_isler || []}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: "İş Başlığı",
              dataIndex: "baslik",
              render: (t) => <b>{t}</b>,
            },
            {
              title: "Sorumlular",
              dataIndex: "atananlar",
              render: (a) => (a ? a.join(", ") : "-"),
            },
            {
              title: "Teslim Tarihi",
              dataIndex: "tarih",
              render: (t) => {
                const tarih = dayjs(t);
                const gecikmis = tarih.isBefore(dayjs(), "day");
                return (
                  <Tag color={gecikmis ? "red" : "orange"}>
                    {tarih.format("DD.MM.YYYY")} (
                    {gecikmis ? "Gecikti" : "Yaklaşıyor"})
                  </Tag>
                );
              },
            },
          ]}
        />
      </Modal>

      {/* 3. İZİNLİLER DETAYI */}
      <Modal
        title="Bugün İzinli Olan Personel"
        open={izinModal}
        onCancel={() => setIzinModal(false)}
        footer={null}
      >
        <Table
          dataSource={izinDetay}
          rowKey="id"
          pagination={false}
          columns={[
            { title: "Personel", dataIndex: "talep_eden" },
            {
              title: "Departman",
              dataIndex: "departman",
              render: (d) => <Tag>{d}</Tag>,
            },
            { title: "İzin Türü", dataIndex: "tur" },
            {
              title: "Dönüş Tarihi",
              dataIndex: "bitis_tarihi",
              render: (t) => dayjs(t).format("DD.MM.YYYY"),
            },
          ]}
        />
        {izinDetay.length === 0 && (
          <div style={{ textAlign: "center", padding: 20 }}>
            Bugün ofis tam kadro! 🎉
          </div>
        )}
      </Modal>

      {/* 4. PROJE DURUMLARI DETAYI */}
      <Modal
        title="Proje/Görev Durumları"
        open={projeModal}
        onCancel={() => setProjeModal(false)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={veri.gorevDurumlari || []}
          rowKey="durum"
          pagination={false}
          columns={[
            {
              title: "Durum",
              dataIndex: "durum",
              render: (t) => <b>{t}</b>,
            },
            { title: "Adet", dataIndex: "count", align: "center" },
          ]}
        />
      </Modal>

      {/* 5. PERSONEL ONAY MODALI */}
      <Modal
        title="Aramıza Katılmak İsteyenler"
        open={personelModal}
        onCancel={() => setPersonelModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={bekleyenPersonel}
          rowKey="id"
          pagination={false}
          columns={[
            { title: "Ad Soyad", dataIndex: "ad_soyad" },
            { title: "Departman", dataIndex: "departman" },
            { title: "Pozisyon", dataIndex: "pozisyon" },
            { title: "Email", dataIndex: "email" },
            {
              title: "İşlem",
              render: (_, r) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => personelOnayla(r.id, "Aktif")}
                  >
                    Onayla
                  </Button>
                  <Button
                    danger
                    size="small"
                    onClick={() => personelOnayla(r.id, "Reddedildi")}
                  >
                    Reddet
                  </Button>
                </Space>
              ),
            },
          ]}
        />
        {bekleyenPersonel.length === 0 && (
          <div style={{ padding: 20, textAlign: "center" }}>
            Bekleyen başvuru yok.
          </div>
        )}
      </Modal>
    </div>
  );
}
