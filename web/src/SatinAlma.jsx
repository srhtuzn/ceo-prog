import { useState, useEffect } from "react";
import {
  Table,
  Button,
  Card,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Upload,
  message,
  Space,
  Typography,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  FilePdfOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  GlobalOutlined,
} from "@ant-design/icons";

const API_URL = "http://localhost:3000";
const { Option } = Select;
const { Text } = Typography;

export default function SatinAlma({ aktifKullanici }) {
  const [talepler, setTalepler] = useState([]);
  const [projeler, setProjeler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  // --- GÜNCELLEME: Kur Bilgisi Obje Oldu (USD ve EUR) ---
  const [kurBilgisi, setKurBilgisi] = useState({ usd: null, eur: null });
  const [kurYukleniyor, setKurYukleniyor] = useState(false);

  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDepartman, setFiltreDepartman] = useState(null);
  const [filtreProje, setFiltreProje] = useState(null);

  const [form] = Form.useForm();

  if (!aktifKullanici)
    return <div style={{ padding: 20 }}>Kullanıcı verisi yükleniyor...</div>;

  useEffect(() => {
    veriCek();
    projeCek();
  }, []);

  const handle401 = () => {
    // Ortak 401 handling
    localStorage.removeItem("wf_user");
    // Token da varsa temizleyelim
    localStorage.removeItem("wf_token");
    window.location.reload();
  };

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/finans`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handle401();
          return [];
        }
        return res.json();
      })
      .then((data) => {
        setTalepler(Array.isArray(data) ? data : []);
        setYukleniyor(false);
      })
      .catch((err) => {
        console.error("Finans talepleri alınamadı:", err);
        setYukleniyor(false);
      });
  };

  // BURASI GÜNCELLENDİ: Projeler çağrısına da token ekliyoruz
  const projeCek = () => {
    fetch(`${API_URL}/gorevler/projeler`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          handle401();
          return [];
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setProjeler(data);
      })
      .catch((err) => {
        console.error("Projeler alınamadı:", err);
      });
  };

  // --- GÜNCELLEME: Hem Dolar Hem Euro Çekme ---
  const kurGetir = async () => {
    setKurYukleniyor(true);
    try {
      // İki isteği aynı anda (paralel) atıyoruz, beklememek için
      const [resUSD, resEUR] = await Promise.all([
        fetch("https://api.exchangerate-api.com/v4/latest/USD"),
        fetch("https://api.exchangerate-api.com/v4/latest/EUR"),
      ]);

      const dataUSD = await resUSD.json();
      const dataEUR = await resEUR.json();

      setKurBilgisi({
        usd: dataUSD.rates.TRY,
        eur: dataEUR.rates.TRY,
      });

      message.success("Güncel kurlar çekildi");
    } catch (error) {
      console.error("Kur bilgisi hatası:", error);
      message.error("Kur bilgisi alınamadı");
    } finally {
      setKurYukleniyor(false);
    }
  };
  // ------------------------------------------------

  const filtrelenmisTalepler = talepler.filter((talep) => {
    const metinUyumu =
      talep.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (talep.talep_eden &&
        talep.talep_eden.toLowerCase().includes(aramaMetni.toLowerCase()));
    const departmanUyumu = filtreDepartman
      ? talep.departman === filtreDepartman
      : true;
    const projeUyumu = filtreProje ? talep.proje_id === filtreProje : true;
    return metinUyumu && departmanUyumu && projeUyumu;
  });

  const formGonder = (degerler) => {
    const formData = new FormData();
    formData.append("baslik", degerler.baslik);
    formData.append("aciklama", degerler.aciklama || "");
    formData.append("tutar", degerler.tutar);
    formData.append("para_birimi", degerler.para_birimi);
    formData.append("departman", degerler.departman);
    if (degerler.proje_id) formData.append("proje_id", degerler.proje_id);
    if (degerler.dosya && degerler.dosya.length > 0) {
      formData.append("dosya", degerler.dosya[0].originFileObj);
    }

    fetch(`${API_URL}/finans`, {
      method: "POST",
      body: formData,
      headers: {
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          throw new Error("Oturum süresi doldu.");
        }
        return res.json();
      })
      .then(() => {
        message.success("Talep oluşturuldu");
        setModalAcik(false);
        form.resetFields();
        veriCek();
      })
      .catch((err) => message.error(err.message || "Hata oluştu"));
  };

  const onaylaReddet = (id, islem) => {
    fetch(`${API_URL}/finans/onay/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
      body: JSON.stringify({ islem: islem }),
    })
      .then((res) => {
        if (res.status === 401) {
          handle401();
          return;
        }
        return res.json().catch(() => null);
      })
      .then(() => {
        message.success(`İşlem yapıldı: ${islem}`);
        veriCek();
      })
      .catch((err) => {
        console.error("Onay/Reddet hatası:", err);
        message.error("İşlem tamamlanamadı");
      });
  };

  const columns = [
    { title: "Talep Eden", dataIndex: "talep_eden" },
    {
      title: "Departman",
      dataIndex: "departman",
      render: (d) => <Tag>{d}</Tag>,
    },
    {
      title: "Proje",
      dataIndex: "proje_id",
      render: (pid) => {
        const p = projeler.find((x) => x.id === pid);
        return p ? (
          <Tag color="cyan">{p.ad}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        );
      },
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => (
        <div>
          <strong>{t}</strong>
          {r.dosya_yolu && (
            <a
              href={`${API_URL}/uploads/${r.dosya_yolu}`}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 10, color: "red" }}
            >
              <FilePdfOutlined /> Dosya
            </a>
          )}
        </div>
      ),
    },
    {
      title: "Tutar",
      render: (_, r) => (
        <Tag color="green">
          {parseFloat(r.tutar).toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
          })}{" "}
          {r.para_birimi}
        </Tag>
      ),
    },
    {
      title: "Durum",
      dataIndex: "durum",
      render: (d) => {
        let color = "blue";
        if (d && d.includes("Reddedildi")) color = "red";
        if (d && d.includes("Onaylandı")) color = "success";
        return <Tag color={color}>{d}</Tag>;
      },
    },
    {
      title: "İşlem",
      render: (_, r) => {
        const rol = aktifKullanici?.rol || "";
        const isFinans = rol.includes("Muhasebe") || rol.includes("Finans");
        const isGM = rol.includes("Genel Müdür");

        return (
          <Space>
            {r.durum === "Finans Onayı Bekliyor" && (isFinans || isGM) && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onaylaReddet(r.id, "Onayla")}
                >
                  {isGM ? "Direkt Onayla" : "Onayla"}
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
            {r.durum === "Genel Müdür Onayı Bekliyor" && isGM && (
              <>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onaylaReddet(r.id, "Onayla")}
                >
                  GM Onayı Ver
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
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card
        title="Satın Alma Talepleri"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalAcik(true)}
          >
            Yeni Talep
          </Button>
        }
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Input
            placeholder="Ara..."
            prefix={<SearchOutlined style={{ color: "#ccc" }} />}
            style={{ width: 250 }}
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Departman"
            style={{ width: 150 }}
            allowClear
            onChange={setFiltreDepartman}
            value={filtreDepartman}
          >
            <Option value="Bilgi İşlem">Bilgi İşlem</Option>
            <Option value="Muhasebe">Muhasebe</Option>
            <Option value="Satış">Satış</Option>
            <Option value="Yönetim">Yönetim</Option>
          </Select>
          <Select
            placeholder="Proje"
            style={{ width: 200 }}
            allowClear
            onChange={setFiltreProje}
            value={filtreProje}
          >
            {projeler.map((p) => (
              <Option key={p.id} value={p.id}>
                {p.ad}
              </Option>
            ))}
          </Select>
          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              setAramaMetni("");
              setFiltreDepartman(null);
              setFiltreProje(null);
            }}
          >
            Temizle
          </Button>
        </div>
        <Table
          dataSource={filtrelenmisTalepler}
          columns={columns}
          rowKey="id"
          loading={yukleniyor}
        />
      </Card>

      <Modal
        title="Yeni Satın Alma Talebi"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={formGonder}>
          {/* API ENTEGRASYON ALANI (GÜNCELLENDİ: USD + EUR) */}
          <div
            style={{
              marginBottom: 15,
              padding: 10,
              background: "#f6ffed",
              border: "1px solid #b7eb8f",
              borderRadius: 6,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Space>
              <GlobalOutlined style={{ color: "#52c41a" }} />
              <Text strong style={{ fontSize: 12 }}>
                Dış Servis Entegrasyonu
              </Text>
            </Space>
            <Space>
              {kurBilgisi.usd && (
                <Text type="success" strong style={{ marginRight: 10 }}>
                  🇺🇸 1 USD = {kurBilgisi.usd} ₺
                </Text>
              )}
              {kurBilgisi.eur && (
                <Text type="success" strong>
                  🇪🇺 1 EUR = {kurBilgisi.eur} ₺
                </Text>
              )}
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={kurYukleniyor}
                onClick={kurGetir}
              >
                Kurları Getir
              </Button>
            </Space>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Form.Item
              name="departman"
              label="Departman"
              style={{ flex: 1 }}
              initialValue={aktifKullanici.departman}
            >
              <Select disabled={!aktifKullanici.rol.includes("Genel Müdür")}>
                <Option value="Bilgi İşlem">Bilgi İşlem</Option>
                <Option value="Muhasebe">Muhasebe</Option>
                <Option value="Satış">Satış</Option>
                <Option value="Yönetim">Yönetim</Option>
                <Option value="İK">İnsan Kaynakları</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="proje_id"
              label="İlgili Proje (Opsiyonel)"
              style={{ flex: 1 }}
            >
              <Select allowClear placeholder="Proje Seçin">
                {projeler.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.ad}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="baslik"
            label="Ürün/Hizmet Adı"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="aciklama" label="Açıklama / Gerekçe">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div style={{ display: "flex", gap: 10 }}>
            <Form.Item
              name="tutar"
              label="Tutar"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <InputNumber style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="para_birimi"
              label="Birim"
              style={{ width: 100 }}
              initialValue="TL"
            >
              <Select>
                <Option value="TL">TL</Option>
                <Option value="USD">USD</Option>
                <Option value="EUR">EUR</Option>
              </Select>
            </Form.Item>
          </div>
          <Form.Item
            name="dosya"
            label="Proforma / Teklif (PDF)"
            valuePropName="fileList"
            getValueFromEvent={(e) => (Array.isArray(e) ? e : e && e.fileList)}
          >
            <Upload maxCount={1} beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>Dosya Seç</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Talebi Gönder
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
