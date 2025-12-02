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
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  StopOutlined,
  FastForwardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function IzinYonetimi({ aktifKullanici }) {
  const [izinler, setIzinler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [form] = Form.useForm();
  const [kullanilanIzin, setKullanilanIzin] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [toplamHak, setToplamHak] = useState(14);

  if (!aktifKullanici)
    return <div style={{ padding: 20 }}>Kullanıcı verisi bekleniyor...</div>;

  useEffect(() => {
    veriCek();
    izinHakkiCek();
  }, []);

  const veriCek = () => {
    setYukleniyor(true);
    // userId gönderiyoruz ki backend kimin istediğini bilsin
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
        setKullanilanIzin(data.kullanılan || 0);
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
            <Badge
              status="warning"
              text={i.talep_eden}
              style={{ fontSize: 10 }}
            />
          </li>
        ))}
      </ul>
    );
  };

  const columns = [
    { title: "Personel", dataIndex: "talep_eden" },
    {
      title: "Tür",
      dataIndex: "tur",
      render: (t) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: "Tarih",
      render: (_, r) => (
        <span>
          {dayjs(r.baslangic_tarihi).format("DD.MM")} -{" "}
          {dayjs(r.bitis_tarihi).format("DD.MM")} ({r.gun_sayisi} gün)
        </span>
      ),
    },
    {
      title: "Durum",
      dataIndex: "durum",
      render: (d) => {
        let color = "orange";
        if (d === "Onaylandı") color = "green";
        if (d === "Reddedildi") color = "red";
        if (d === "İptal Edildi") color = "default";
        return <Tag color={color}>{d}</Tag>;
      },
    },
    {
      title: "İşlem",
      render: (_, r) => {
        const rol = aktifKullanici?.rol || "";
        const kendiTalebi = r.talep_eden === aktifKullanici.ad_soyad;
        const durum = r.durum || "";

        const gmMi = rol.includes("Genel Müdür");
        const mudurMu =
          rol.includes("Departman Müdürü") ||
          rol.includes("Yönetici") ||
          rol.includes("Süpervizör");

        // BUTON MANTIĞI BURADA KURULUYOR 🧠
        return (
          <Space>
            {/* SENARYO 1: YÖNETİCİ ONAYI BEKLENİYOR (İlk Aşama) */}
            {durum === "Yönetici Onayı Bekliyor" && (
              <>
                {/* Müdür Sadece 'Onayla' (GM'ye sevk et) ve 'Reddet' görür */}
                {mudurMu && !gmMi && (
                  <>
                    <Tooltip title="Onayla ve GM'ye Gönder">
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={() => onaylaReddet(r.id, "Onayla")}
                      >
                        Onayla
                      </Button>
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => onaylaReddet(r.id, "Reddet")}
                    >
                      Reddet
                    </Button>
                  </>
                )}

                {/* GM Sadece 'Direkt Onayla' (Hızlı Onay) ve 'Reddet' görür */}
                {gmMi && (
                  <>
                    <Tooltip title="Müdürü beklemeden direkt onayla">
                      <Button
                        size="small"
                        style={{ backgroundColor: "#722ed1", color: "white" }}
                        icon={<FastForwardOutlined />}
                        onClick={() => onaylaReddet(r.id, "Direkt Onayla")}
                      >
                        Direkt Onayla
                      </Button>
                    </Tooltip>
                    <Button
                      size="small"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => onaylaReddet(r.id, "Reddet")}
                    >
                      Reddet
                    </Button>
                  </>
                )}
              </>
            )}

            {/* SENARYO 2: GM ONAYI BEKLENİYOR (İkinci Aşama) */}
            {durum === "Genel Müdür Onayı Bekliyor" && gmMi && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onaylaReddet(r.id, "Onayla")}
                >
                  Son Onayı Ver
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => onaylaReddet(r.id, "Reddet")}
                >
                  Reddet
                </Button>
              </>
            )}

            {/* İPTAL BUTONU (Sadece kendi talebi ve bekliyorsa) */}
            {kendiTalebi && durum.includes("Bekliyor") && (
              <Popconfirm title="İptal et?" onConfirm={() => iptalEt(r.id)}>
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

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={8}>
          <Card>
            <Statistic title="Toplam Hak" value={toplamHak} suffix="Gün" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Kullanılan"
              value={kullanilanIzin}
              valueStyle={{ color: "#faad14" }}
              suffix="Gün"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Kalan"
              value={toplamHak - kullanilanIzin}
              valueStyle={{
                color: toplamHak - kullanilanIzin < 3 ? "red" : "#3f8600",
              }}
              suffix="Gün"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="İzin Talepleri"
            extra={
              !aktifKullanici.rol.includes("Genel Müdür") && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModalAcik(true)}
                >
                  İzin İste
                </Button>
              )
            }
          >
            <Table
              dataSource={izinler}
              columns={columns}
              rowKey="id"
              pagination={{ pageSize: 5 }}
              loading={yukleniyor}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="İzin Takvimi">
            <Calendar fullscreen={false} cellRender={dateCellRender} />
          </Card>
        </Col>
      </Row>

      <Modal
        title="İzin Talep Formu"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={formGonder}>
          <Form.Item name="tur" label="Tür" initialValue="Yıllık İzin">
            <Select>
              <Option value="Yıllık İzin">Yıllık İzin</Option>
              <Option value="Rapor">Rapor</Option>
            </Select>
          </Form.Item>
          <Form.Item name="tarih" label="Tarih" rules={[{ required: true }]}>
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="aciklama" label="Açıklama">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Gönder
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
