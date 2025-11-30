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
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const API_URL = "http://localhost:3000";
const { Option } = Select;
const { RangePicker } = DatePicker;

export default function IzinYonetimi({ aktifKullanici }) {
  const [izinler, setIzinler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [form] = Form.useForm();
  const [kullanilanIzin, setKullanilanIzin] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(false); // Yükleniyor state'i eklendi

  const [toplamHak, setToplamHak] = useState(14); // Varsayılan 14, veritabanından güncellenecek

  // Güvenlik: Kullanıcı verisi yoksa bekle
  if (!aktifKullanici)
    return <div style={{ padding: 20 }}>Kullanıcı verisi bekleniyor...</div>;

  useEffect(() => {
    veriCek();
    izinHakkiCek();
  }, []);

  const veriCek = () => {
    setYukleniyor(true);
    // Backend'e "Ben kimim?" bilgisini gönderiyoruz (userId)
    fetch(`${API_URL}/izinler?userId=${aktifKullanici.id}`)
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
    fetch(`${API_URL}/izinler/kullanilan/${aktifKullanici.ad_soyad}`)
      .then((res) => res.json())
      .then((data) => {
        setKullanilanIzin(data.kullanılan || 0);
        setToplamHak(data.toplam_hak || 14); // <-- YENİ: Hakkı güncelle
      })
      .catch(() => {
        setKullanilanIzin(0);
        setToplamHak(14);
      });
  };

  const formGonder = (degerler) => {
    // 1. Gün Hesabı
    const start = dayjs(degerler.tarih[0]);
    const end = dayjs(degerler.tarih[1]);
    const talepEdilenGun = end.diff(start, "day") + 1;

    // 2. KONTROL: Hak yetiyor mu?
    const kalanHak = toplamHak - kullanilanIzin;

    // Sadece Yıllık İzinse kontrol et (Rapor/Mazeret hakkı etkilemez genelde ama siz bilirsiniz)
    if (degerler.tur === "Yıllık İzin" && talepEdilenGun > kalanHak) {
      Modal.error({
        title: "Yetersiz İzin Hakkı!",
        content: `Kalan hakkınız: ${kalanHak} gün. Talep edilen: ${talepEdilenGun} gün. Lütfen tarihi düzeltin veya yöneticinizle görüşün.`,
      });
      return; // <--- İŞLEMİ DURDUR
    }

    fetch(`${API_URL}/izinler`, {
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
    fetch(`${API_URL}/izinler/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onaylayan_rol: rol, islem: islem }),
    }).then(() => {
      message.success(`İzin ${islem}ildi`);
      veriCek();
      izinHakkiCek();
    });
  };

  const iptalEt = (id) => {
    fetch(`${API_URL}/izinler/iptal/${id}`, { method: "PUT" }).then(
      async (res) => {
        const data = await res.json();
        if (res.ok) {
          message.success("Talep iptal edildi");
          veriCek();
        } else {
          message.error(data.error);
        }
      }
    );
  };

  // --- TAKVİM HÜCRELERİ ---
  const dateCellRender = (value) => {
    const tarihStr = value.format("YYYY-MM-DD");
    // Sadece ONAYLI izinleri takvimde göster
    const oGunIzinliler = izinler.filter(
      (i) =>
        i.durum &&
        i.durum.includes("Onaylandı") &&
        tarihStr >= dayjs(i.baslangic_tarihi).format("YYYY-MM-DD") &&
        tarihStr <= dayjs(i.bitis_tarihi).format("YYYY-MM-DD")
    );

    return (
      <ul style={{ listStyle: "none", padding: 0 }}>
        {oGunIzinliler.map((i) => (
          <li key={i.id}>
            <Badge
              status="warning"
              text={`${i.talep_eden} (${i.tur})`}
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
      title: "Tarihler",
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
        if (d && d.includes("Onaylandı")) color = "green";
        if (d && d.includes("Reddedildi")) color = "red";
        if (d && d.includes("İptal")) color = "default";
        return <Tag color={color}>{d}</Tag>;
      },
    },
    {
      title: "İşlem",
      render: (_, r) => {
        const rol = aktifKullanici?.rol || "";
        const kendiTalebi = r.talep_eden === aktifKullanici.ad_soyad;
        // Durum undefined gelirse patlamasın diye boş string
        const durum = r.durum || "";
        const bekliyor = durum.includes("Bekliyor");

        // Yetkiler
        const gmMi = rol.includes("Genel Müdür");
        const mudurMu =
          rol.includes("Departman Müdürü") || rol.includes("Yönetici");

        return (
          <Space>
            {/* DURUM 1: YÖNETİCİ ONAYI BEKLİYOR */}
            {durum === "Yönetici Onayı Bekliyor" && (mudurMu || gmMi) && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onaylaReddet(r.id, "Onayla")}
                >
                  {gmMi ? "Direkt Onayla" : "Onayla"}
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

            {/* DURUM 2: GM ONAYI BEKLİYOR */}
            {durum === "Genel Müdür Onayı Bekliyor" && gmMi && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onaylaReddet(r.id, "Onayla")}
                >
                  GM Onayı
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

            {/* İPTAL BUTONU (Sadece kendi talebi ve henüz bekliyorsa) */}
            {kendiTalebi && bekliyor && (
              <Popconfirm
                title="Talebi iptal et?"
                onConfirm={() => iptalEt(r.id)}
              >
                <Button
                  size="small"
                  type="dashed"
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
      <div style={{ marginBottom: 20 }}>
        <Card>
          <Row gutter={16} style={{ textAlign: "center" }}>
            <Col span={8}>
              <Statistic title="Toplam Hak" value={toplamHak} suffix="Gün" />
            </Col>
            <Col span={8}>
              <Statistic
                title="Kullanılan"
                value={kullanilanIzin}
                valueStyle={{ color: "#faad14" }}
                suffix="Gün"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Kalan"
                value={toplamHak - kullanilanIzin}
                valueStyle={{
                  color: toplamHak - kullanilanIzin < 3 ? "red" : "#3f8600",
                }}
                suffix="Gün"
              />
            </Col>
          </Row>
        </Card>
      </div>
      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="İzin Talepleri"
            // GENEL MÜDÜR İZİN İSTEMEZ, BUTONU GİZLE
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
          <Card title="İzin Takvimi (Onaylananlar)">
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
          <Form.Item name="tur" label="İzin Türü" initialValue="Yıllık İzin">
            <Select>
              <Option value="Yıllık İzin">Yıllık İzin</Option>
              <Option value="Hastalık/Rapor">Hastalık / Rapor</Option>
              <Option value="Mazeret İzni">Mazeret İzni</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="tarih"
            label="Tarih Aralığı"
            rules={[{ required: true }]}
          >
            <RangePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="aciklama" label="Açıklama">
            <Input.TextArea rows={2} placeholder="Neden?" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Talebi Gönder
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
