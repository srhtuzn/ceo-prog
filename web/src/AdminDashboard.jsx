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
} from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  AlertOutlined,
  ProjectOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function AdminDashboard() {
  const [veri, setVeri] = useState(null);

  // MODAL STATE'LERİ
  const [finansModal, setFinansModal] = useState(false);
  const [riskModal, setRiskModal] = useState(false);
  const [izinModal, setIzinModal] = useState(false);
  const [projeModal, setProjeModal] = useState(false);

  // DETAY VERİLERİ
  const [finansDetay, setFinansDetay] = useState([]);
  const [izinDetay, setIzinDetay] = useState([]);

  // KULLANICIYI HAFIZADAN AL (Hata Buradaydı: Kimliksiz istek atıyorduk)
  const aktifKullanici = JSON.parse(localStorage.getItem("wf_user"));

  useEffect(() => {
    fetch(`${API_URL}/dashboard/ozet`)
      .then((res) => res.json())
      .then((data) => setVeri(data));
  }, []);

  // 1. FİNANS DETAYI (DÜZELTİLDİ: Kimlik Eklendi)
  const finansDetayGoster = () => {
    // userId ekledik
    fetch(`${API_URL}/satin-alma?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        const bekleyenler = data.filter((d) => d.durum.includes("Bekliyor"));
        setFinansDetay(bekleyenler);
        setFinansModal(true);
      });
  };

  // 2. İZİN DETAYI (DÜZELTİLDİ: Kimlik Eklendi)
  const izinDetayGoster = () => {
    // userId ekledik. Yönetici olduğumuz için herkesi göreceğiz.
    fetch(`${API_URL}/izinler?userId=${aktifKullanici.id}`)
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
              value={veri.bekleyen_odeme}
              precision={2}
              suffix="₺"
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
              value={veri.riskli_isler.length}
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
              value={veri.bugun_izinli}
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
              title="Şirket Başarı Oranı"
              value={Math.round((veri.biten / (veri.toplam || 1)) * 100)}
              suffix="%"
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
            <div style={{ fontSize: 12, color: "#999", marginTop: 5 }}>
              Proje bazlı detay
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
                <ProjectOutlined /> Proje İlerleme Durumları
              </span>
            }
          >
            <List
              dataSource={veri.proje_durumlari}
              renderItem={(item) => {
                const toplam = item.toplam_is || 1;
                const yuzde = Math.round((item.biten_is / toplam) * 100);
                return (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 5,
                        }}
                      >
                        <strong>{item.ad || "Genel Görevler"}</strong>
                        <span style={{ color: "#888" }}>
                          {item.biten_is} / {item.toplam_is} Görev
                        </span>
                      </div>
                      <Progress
                        percent={yuzde}
                        status={yuzde === 100 ? "success" : "active"}
                        strokeColor={
                          yuzde < 30 ? "red" : yuzde < 70 ? "orange" : "#52c41a"
                        }
                      />
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
              dataSource={veri.riskli_isler}
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
            {veri.riskli_isler.length === 0 && (
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
          dataSource={veri.riskli_isler}
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
        title="Proje Bazlı İlerleme"
        open={projeModal}
        onCancel={() => setProjeModal(false)}
        footer={null}
        width={600}
      >
        <Table
          dataSource={veri.proje_durumlari}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: "Proje Adı",
              dataIndex: "ad",
              render: (t) => <b>{t || "Genel İşler"}</b>,
            },
            { title: "Toplam İş", dataIndex: "toplam_is", align: "center" },
            {
              title: "Biten",
              dataIndex: "biten_is",
              align: "center",
              render: (t) => (
                <span style={{ color: "green", fontWeight: "bold" }}>{t}</span>
              ),
            },
            {
              title: "İlerleme",
              render: (_, r) => {
                const toplam = r.toplam_is || 1;
                const yuzde = Math.round((r.biten_is / toplam) * 100);
                return (
                  <Progress
                    percent={yuzde}
                    size="small"
                    status={yuzde === 100 ? "success" : "active"}
                  />
                );
              },
            },
          ]}
        />
      </Modal>
    </div>
  );
}
