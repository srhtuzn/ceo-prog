import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Card,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Space,
  Calendar,
  Badge,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tooltip,
  Tabs,
  Progress,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  FastForwardOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  HomeOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const { Option } = Select;
const { RangePicker } = DatePicker;

// İzin Türlerine Göre Renk ve İkonlar
const IZIN_TURLERI = {
  "Yıllık İzin": { color: "blue", icon: <CalendarOutlined /> },
  "Hastalık/Rapor": { color: "red", icon: <MedicineBoxOutlined /> },
  "Mazeret İzni": { color: "orange", icon: <HomeOutlined /> },
};

export default function IzinYonetimi({ aktifKullanici }) {
  const [izinler, setIzinler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [form] = Form.useForm();
  const [kullanilanIzin, setKullanilanIzin] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [toplamHak, setToplamHak] = useState(14);

  const [aktifTab, setAktifTab] = useState("hepsi"); // Filtreleme için

  if (!aktifKullanici)
    return <div style={{ padding: 20 }}>Kullanıcı verisi bekleniyor...</div>;

  useEffect(() => {
    veriCek();
    izinHakkiCek();
  }, []);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/ik/izinler?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setIzinler(data);
        else setIzinler([]);
        setYukleniyor(false);
      })
      .catch(() => {
        setIzinler([]);
        setYukleniyor(false);
      });
  };

  const izinHakkiCek = () => {
    fetch(`${API_URL}/ik/izinler/kullanilan/${aktifKullanici.ad_soyad}`)
      .then((res) => res.json())
      .then((data) => {
        setKullanilanIzin(data.kullanilan || 0);
        setToplamHak(data.toplam_hak || 14);
      })
      .catch(() => {
        setKullanilanIzin(0);
        setToplamHak(14);
      });
  };

  const formGonder = (degerler) => {
    const start = dayjs(degerler.tarih[0]);
    const end = dayjs(degerler.tarih[1]);
    const talepEdilenGun = end.diff(start, "day") + 1;
    const kalanHak = toplamHak - kullanilanIzin;

    if (degerler.tur === "Yıllık İzin" && talepEdilenGun > kalanHak) {
      Modal.error({
        title: "Yetersiz İzin Hakkı!",
        content: `Kalan: ${kalanHak}, Talep: ${talepEdilenGun}.`,
      });
      return;
    }

    const payload = {
      ad_soyad: aktifKullanici.ad_soyad,
      baslangic_tarihi: start.format("YYYY-MM-DD"),
      bitis_tarihi: end.format("YYYY-MM-DD"),
      aciklama: degerler.aciklama,
      turu: degerler.tur,
      gun_sayisi: talepEdilenGun,
    };

    fetch(`${API_URL}/ik/izinler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(() => {
      message.success("İzin talebi oluşturuldu");
      setModalAcik(false);
      form.resetFields();
      veriCek();
      izinHakkiCek();
    });
  };

  const onaylaReddet = (id, islem) => {
    const rol = aktifKullanici?.rol || "";
    fetch(`${API_URL}/ik/izinler/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onaylayan_rol: rol, islem: islem }),
    }).then(() => {
      message.success(`İşlem Başarılı: ${islem}`);
      veriCek();
      izinHakkiCek();
    });
  };

  const iptalEt = (id) => {
    fetch(`${API_URL}/ik/izinler/iptal/${id}`, { method: "PUT" }).then(
      (res) => {
        if (res.ok) {
          message.success("İptal edildi");
          veriCek();
          izinHakkiCek();
        }
      }
    );
  };

  const dateCellRender = (value) => {
    const tarihStr = value.format("YYYY-MM-DD");
    const oGunIzinliler = izinler.filter(
      (i) =>
        i.durum === "Onaylandı" &&
        tarihStr >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
        tarihStr <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
    );
    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {oGunIzinliler.map((i) => (
          <li key={i.id}>
            <Tag
              color={IZIN_TURLERI[i.tur]?.color || "default"}
              style={{
                width: "100%",
                fontSize: 10,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {i.talep_eden}
            </Tag>
          </li>
        ))}
      </ul>
    );
  };

  // FİLTRELEME MANTIĞI
  const filtrelenmisIzinler = izinler.filter((i) => {
    if (aktifTab === "hepsi") return true;
    if (aktifTab === "bekleyen") return i.durum.includes("Bekliyor");
    if (aktifTab === "onayli") return i.durum === "Onaylandı";
    if (aktifTab === "red")
      return i.durum === "Reddedildi" || i.durum.includes("İptal");
    return true;
  });

  const columns = [
    {
      title: "Personel",
      dataIndex: "talep_eden",
      render: (t) => <span style={{ fontWeight: 600 }}>{t}</span>,
    },
    {
      title: "Tür",
      dataIndex: "tur",
      render: (t) => {
        const meta = IZIN_TURLERI[t] || {};
        return (
          <Tag color={meta.color} icon={meta.icon}>
            {t}
          </Tag>
        );
      },
    },
    {
      title: "Tarih Aralığı",
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div>
            {dayjs(r.baslangic_tarihi).format("DD.MM.YYYY")} -{" "}
            {dayjs(r.bitis_tarihi).format("DD.MM.YYYY")}
          </div>
          <div style={{ color: "#888" }}>
            <ClockCircleOutlined /> {r.gun_sayisi} Gün
          </div>
        </div>
      ),
    },
    {
      title: "Durum",
      dataIndex: "durum",
      render: (d) => {
        let color = "orange";
        let icon = <ClockCircleOutlined />;
        if (d === "Onaylandı") {
          color = "success";
          icon = <CheckCircleOutlined />;
        }
        if (d === "Reddedildi") {
          color = "error";
          icon = <StopOutlined />;
        }
        if (d === "İptal Edildi") {
          color = "default";
          icon = <StopOutlined />;
        }
        return (
          <Tag icon={icon} color={color}>
            {d}
          </Tag>
        );
      },
    },
    {
      title: "İşlem",
      align: "center",
      render: (_, r) => {
        const rol = aktifKullanici?.rol || "";
        const kendiTalebi = r.talep_eden === aktifKullanici.ad_soyad;
        const durum = r.durum || "";
        const gmMi = rol.includes("Genel Müdür");
        const mudurMu =
          rol.includes("Departman Müdürü") ||
          rol.includes("Yönetici") ||
          rol.includes("Süpervizör");

        return (
          <Space>
            {durum === "Yönetici Onayı Bekliyor" && (
              <>
                {mudurMu && !gmMi && (
                  <>
                    <Tooltip title="Onayla ve GM'ye Gönder">
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => onaylaReddet(r.id, "Onayla")}
                      />
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => onaylaReddet(r.id, "Reddet")}
                    />
                  </>
                )}
                {gmMi && (
                  <>
                    <Tooltip title="Müdürü atla ve direkt onayla">
                      <Button
                        size="small"
                        style={{ backgroundColor: "#722ed1", color: "white" }}
                        icon={<FastForwardOutlined />}
                        onClick={() => onaylaReddet(r.id, "Direkt Onayla")}
                      />
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => onaylaReddet(r.id, "Reddet")}
                    />
                  </>
                )}
              </>
            )}

            {durum === "Genel Müdür Onayı Bekliyor" && gmMi && (
              <>
                <Tooltip title="Son Onayı Ver">
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => onaylaReddet(r.id, "Onayla")}
                  />
                </Tooltip>
                <Button
                  size="small"
                  danger
                  onClick={() => onaylaReddet(r.id, "Reddet")}
                  icon={<StopOutlined />}
                />
              </>
            )}

            {kendiTalebi && durum.includes("Bekliyor") && (
              <Popconfirm
                title="İptal etmek istediğinize emin misiniz?"
                onConfirm={() => iptalEt(r.id)}
              >
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                >
                  İptal
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // İzin Hakkı Doluluk Oranı
  const dolulukOrani = Math.round((kullanilanIzin / toplamHak) * 100);

  return (
    <div>
      {/* ÖZET KARTLARI */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Toplam Yıllık İzin Hakkı"
              value={toplamHak}
              suffix="Gün"
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Row align="middle" justify="space-between">
              <Col>
                <Statistic
                  title="Kullanılan"
                  value={kullanilanIzin}
                  suffix="Gün"
                  valueStyle={{ color: "#1890ff" }}
                />
              </Col>
              <Col>
                <Progress
                  type="circle"
                  percent={dolulukOrani}
                  width={50}
                  format={() => `${dolulukOrani}%`}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Kalan Bakiye"
              value={toplamHak - kullanilanIzin}
              suffix="Gün"
              valueStyle={{
                color: toplamHak - kullanilanIzin < 3 ? "#cf1322" : "#3f8600",
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="İzin Hareketleri"
            extra={
              !aktifKullanici.rol.includes("Genel Müdür") && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModalAcik(true)}
                >
                  Yeni Talep
                </Button>
              )
            }
          >
            <Tabs
              defaultActiveKey="hepsi"
              onChange={setAktifTab}
              items={[
                { label: "Tümü", key: "hepsi" },
                { label: "Bekleyenler", key: "bekleyen" },
                { label: "Onaylananlar", key: "onayli" },
                { label: "Red/İptal", key: "red" },
              ]}
            />
            <Table
              dataSource={filtrelenmisIzinler}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              loading={yukleniyor}
              size="small"
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="İzin Takvimi (Genel Görünüm)">
            <Calendar fullscreen={false} cellRender={dateCellRender} />
          </Card>
        </Col>
      </Row>

      {/* MODAL */}
      <Modal
        title="İzin Talep Formu"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={formGonder}>
          <Form.Item name="tur" label="İzin Türü" initialValue="Yıllık İzin">
            <Select>
              <Option value="Yıllık İzin">🌴 Yıllık İzin</Option>
              <Option value="Hastalık/Rapor">🏥 Hastalık / Rapor</Option>
              <Option value="Mazeret İzni">🏠 Mazeret İzni</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="tarih"
            label="Tarih Aralığı"
            rules={[{ required: true }]}
          >
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="aciklama" label="Açıklama / Not">
            <Input.TextArea
              rows={3}
              placeholder="Örn: Yıllık iznimin 5 gününü kullanmak istiyorum."
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            Talebi Gönder
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
