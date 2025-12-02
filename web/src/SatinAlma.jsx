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
} from "@ant-design/icons";

const API_URL = "http://localhost:3000";
const { Option } = Select;
const { Text } = Typography;

export default function SatinAlma({ aktifKullanici }) {
  const [talepler, setTalepler] = useState([]);
  const [projeler, setProjeler] = useState([]);
  const [modalAcik, setModalAcik] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

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

  const veriCek = () => {
    setYukleniyor(true);
    // YENİ ADRES: /satin-alma yerine /finans
    fetch(`${API_URL}/finans?userId=${aktifKullanici.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTalepler(data);
        else setTalepler([]);
        setYukleniyor(false);
      })
      .catch(() => {
        setTalepler([]);
        setYukleniyor(false);
      });
  };

  const projeCek = () => {
    // YENİ ADRES: /projeler yerine /gorevler/projeler
    fetch(`${API_URL}/gorevler/projeler`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProjeler(data);
      });
  };

  const filtrelenmisTalepler = talepler.filter((talep) => {
    const metinUyumu =
      talep.baslik.toLowerCase().includes(aramaMetni.toLowerCase()) ||
      talep.talep_eden.toLowerCase().includes(aramaMetni.toLowerCase());
    const departmanUyumu = filtreDepartman
      ? talep.departman === filtreDepartman
      : true;
    const projeUyumu = filtreProje ? talep.proje_id === filtreProje : true;
    return metinUyumu && departmanUyumu && projeUyumu;
  });

  const formGonder = (degerler) => {
    const formData = new FormData();
    formData.append("talep_eden", aktifKullanici.ad_soyad);
    formData.append("baslik", degerler.baslik);
    formData.append("aciklama", degerler.aciklama || "");
    formData.append("tutar", degerler.tutar);
    formData.append("para_birimi", degerler.para_birimi);

    formData.append("departman", degerler.departman);
    if (degerler.proje_id) formData.append("proje_id", degerler.proje_id);

    if (degerler.dosya && degerler.dosya.length > 0) {
      formData.append("dosya", degerler.dosya[0].originFileObj);
    }

    // YENİ ADRES
    fetch(`${API_URL}/finans`, { method: "POST", body: formData })
      .then((res) => res.json())
      .then(() => {
        message.success("Talep oluşturuldu");
        setModalAcik(false);
        form.resetFields();
        veriCek();
      })
      .catch(() => message.error("Hata oluştu"));
  };

  const onaylaReddet = (id, islem) => {
    const rol = aktifKullanici?.rol || "";
    // YENİ ADRES
    fetch(`${API_URL}/finans/onay/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onaylayan_rol: rol, islem: islem }),
    }).then(() => {
      message.success(`İşlem yapıldı: ${islem}`);
      veriCek();
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
        const proje = projeler.find((p) => p.id === pid);
        return proje ? (
          <Tag color="cyan">{proje.ad}</Tag>
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
          {r.tutar} {r.para_birimi}
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
        return (
          <Space>
            {(rol.includes("Muhasebe") ||
              rol.includes("Finans") ||
              rol.includes("Genel Müdür")) &&
              r.durum === "Finans Onayı Bekliyor" && (
                <>
                  <Button
                    size="small"
                    type="primary"
                    onClick={() => onaylaReddet(r.id, "Onayla")}
                  >
                    Onayla
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
            {rol.includes("Genel Müdür") &&
              r.durum === "Genel Müdür Onayı Bekliyor" && (
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
            placeholder="Ara (Talep Eden, Ürün)..."
            prefix={<SearchOutlined style={{ color: "#ccc" }} />}
            style={{ width: 250 }}
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            allowClear
          />

          <Select
            placeholder="Departman Seç"
            style={{ width: 150 }}
            allowClear
            onChange={(val) => setFiltreDepartman(val)}
            value={filtreDepartman}
          >
            <Option value="Bilgi İşlem">Bilgi İşlem</Option>
            <Option value="Muhasebe">Muhasebe</Option>
            <Option value="Satış">Satış</Option>
            <Option value="Yönetim">Yönetim</Option>
          </Select>

          <Select
            placeholder="Proje Seç"
            style={{ width: 200 }}
            allowClear
            onChange={(val) => setFiltreProje(val)}
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
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) return e;
              return e && e.fileList;
            }}
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
