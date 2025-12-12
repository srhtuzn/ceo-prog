import { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Upload,
  message,
  Card,
  Space,
  Checkbox,
  Tag,
  Popconfirm,
  List,
  Avatar,
  Divider,
  Typography,
  Mentions,
  Drawer,
  Badge,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  SearchOutlined,
  FilterOutlined,
  FolderAddOutlined,
  SaveOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/tr";
// Takvim yerelleştirmesi için
import locale from "antd/es/date-picker/locale/tr_TR";

// --- YENİ BİLEŞENİ İMPORT EDİYORUZ ---
import GorevListesi from "./components/GorevListesi";

dayjs.locale("tr");
const { Option } = Select;
const { Title, Text } = Typography;
const API_URL = "http://localhost:3000";

// Dosya İkonu Yardımcısı
const getFileIcon = (fileName) => {
  if (!fileName) return <FileOutlined />;
  if (fileName.endsWith(".pdf"))
    return <FilePdfOutlined style={{ color: "red" }} />;
  if (fileName.match(/\.(jpg|jpeg|png|gif)$/))
    return <FileImageOutlined style={{ color: "purple" }} />;
  if (fileName.match(/\.(xls|xlsx|csv)$/))
    return <FileExcelOutlined style={{ color: "green" }} />;
  return <FileOutlined />;
};

export default function GorevYonetimi({
  aktifKullanici,
  projeler = [],
  kullanicilar,
  acilacakGorevId,
  viewMode,
  projeModalAc,
}) {
  // --- STATE TANIMLARI ---
  const [gorevler, setGorevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDurum, setFiltreDurum] = useState(null);
  const [filtreOncelik, setFiltreOncelik] = useState(null);
  const [sadeceBenim, setSadeceBenim] = useState(false);

  // Modal State'leri
  const [modalAcik, setModalAcik] = useState(false);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);
  const [takvimGunModal, setTakvimGunModal] = useState(false);

  // Detay Data State'leri
  const [seciliGorev, setSeciliGorev] = useState(null);
  const [seciliGorevDosyalari, setSeciliGorevDosyalari] = useState([]);
  const [altGorevler, setAltGorevler] = useState([]);
  const [yeniAltGorev, setYeniAltGorev] = useState("");
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState("");
  const [seciliGunIsleri, setSeciliGunIsleri] = useState([]);
  const [seciliTarih, setSeciliTarih] = useState("");

  const [form] = Form.useForm();
  const [detayForm] = Form.useForm();

  const YONETICILER = [
    "Genel Müdür",
    "Departman Müdürü",
    "Süpervizör",
    "Yönetici",
  ];
  const yoneticiMi = YONETICILER.includes(aktifKullanici?.rol);

  useEffect(() => {
    veriCek();
  }, []);

  useEffect(() => {
    if (acilacakGorevId && gorevler.length > 0) {
      const hedef = gorevler.find((g) => g.id === parseInt(acilacakGorevId));
      if (hedef) detayAc(hedef);
    }
  }, [acilacakGorevId, gorevler]);

  // --- API İŞLEMLERİ ---
  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/gorevler`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("wf_user");
          window.location.reload();
          return [];
        }
        return res.json();
      })
      .then((data) => {
        setGorevler(Array.isArray(data) ? data : []);
        setYukleniyor(false);
      })
      .catch(() => {
        setGorevler([]);
        setYukleniyor(false);
      });
  };

  const formGonder = (degerler) => {
    const fd = new FormData();
    fd.append("baslik", degerler.baslik);
    fd.append("aciklama", degerler.aciklama || "");
    fd.append("oncelik", degerler.oncelik || "Orta");
    fd.append("tekrar_tipi", degerler.tekrar_tipi || "Tek Seferlik");
    if (degerler.proje_id) fd.append("proje_id", degerler.proje_id);
    if (degerler.tarih) fd.append("tarih", degerler.tarih.format("YYYY-MM-DD"));
    fd.append("atananlar", JSON.stringify(degerler.atananlar || []));

    if (degerler.dosya) {
      degerler.dosya.forEach((f) => fd.append("dosyalar", f.originFileObj));
    }

    fetch(`${API_URL}/gorevler`, {
      method: "POST",
      body: fd,
      headers: { Authorization: `Bearer ${localStorage.getItem("wf_token")}` },
    })
      .then((res) => res.json())
      .then(() => {
        veriCek();
        message.success("Görev oluşturuldu");
        setModalAcik(false);
        form.resetFields();
      });
  };

  const detayAc = async (kayit) => {
    setSeciliGorev(kayit);
    setDetayModalAcik(true);
    setDuzenlemeModu(false);

    try {
      const res = await fetch(`${API_URL}/gorevler/${kayit.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
        },
      });
      const data = await res.json();
      setSeciliGorev(data);
      setSeciliGorevDosyalari(data.dosyalar || []);

      detayForm.resetFields();
      detayForm.setFieldsValue({
        ...data,
        tarih: data.tarih ? dayjs(data.tarih) : null,
        atananlar: data.atananlar_ids || [],
        proje_id: data.proje_id,
      });
    } catch (e) {}

    // Yorumlar
    fetch(`${API_URL}/gorevler/${kayit.id}/yorumlar`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("wf_token")}` },
    })
      .then((r) => r.json())
      .then(setYorumlar);

    // Alt Görevler
    fetch(`${API_URL}/gorevler/${kayit.id}/alt-gorevler`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("wf_token")}` },
    })
      .then((r) => r.json())
      .then(setAltGorevler);
  };

  const gorevGuncelle = async (v) => {
    const fd = new FormData();
    fd.append("baslik", v.baslik || seciliGorev.baslik);
    fd.append("aciklama", v.aciklama || "");
    fd.append("oncelik", v.oncelik || seciliGorev.oncelik);
    fd.append("durum", seciliGorev.durum);

    if (v.proje_id !== undefined) fd.append("proje_id", v.proje_id || "");
    else if (seciliGorev.proje_id) fd.append("proje_id", seciliGorev.proje_id);

    if (v.tarih) fd.append("tarih", v.tarih.format("YYYY-MM-DD"));
    else if (seciliGorev.tarih)
      fd.append("tarih", dayjs(seciliGorev.tarih).format("YYYY-MM-DD"));

    const atananlarFinal =
      v.atananlar !== undefined ? v.atananlar : seciliGorev.atananlar_ids || [];
    fd.append("atananlar", JSON.stringify(atananlarFinal));

    if (v.dosya && v.dosya.length > 0) {
      v.dosya.forEach((fileItem) => {
        fd.append("dosyalar", fileItem.originFileObj);
      });
    }

    try {
      const res = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`, {
        method: "PUT",
        body: fd,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
        },
      });
      if (!res.ok) throw new Error("Hata");

      message.success("Güncellendi");
      veriCek();

      // Detayı yenile
      const detayRes = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
        },
      });
      const detayData = await detayRes.json();
      setSeciliGorev(detayData);
      setSeciliGorevDosyalari(detayData.dosyalar || []);
      setDuzenlemeModu(false);
    } catch (e) {
      message.error("Hata");
    }
  };

  const handleEditClick = async () => {
    try {
      const values = await detayForm.validateFields();
      gorevGuncelle(values);
    } catch (errorInfo) {
      message.error("Zorunlu alanları kontrol edin.");
    }
  };

  const durumDegistir = (id, d) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "PUT",
      body: JSON.stringify({ durum: d }),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
    }).then(() => {
      setGorevler((prev) =>
        prev.map((g) => (g.id === id ? { ...g, durum: d } : g))
      );
      if (seciliGorev?.id === id)
        setSeciliGorev((prev) => ({ ...prev, durum: d }));
    });
  };

  const handleDragEnd = (e) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      // Not: active.id string gelebilir, parseInt
      const gorevId = parseInt(active.id);
      const yeniDurum = over.id;
      const mevcutDurum = gorevler.find((g) => g.id === gorevId)?.durum;
      if (mevcutDurum !== yeniDurum) {
        durumDegistir(gorevId, yeniDurum);
      }
    }
  };

  const sil = (id) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("wf_token")}` },
    }).then(() => {
      veriCek();
      setDetayModalAcik(false);
      message.success("Silindi");
    });
  };

  // --- ALT GÖREV VE YORUM ---
  const altGorevEkle = () => {
    if (!yeniAltGorev) return;
    fetch(`${API_URL}/gorevler/${seciliGorev.id}/alt-gorevler`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
      body: JSON.stringify({ baslik: yeniAltGorev }),
    })
      .then((r) => r.json())
      .then((y) => {
        setAltGorevler([...altGorevler, y]);
        setYeniAltGorev("");
      });
  };

  const altGorevToggle = (id, d) => {
    fetch(`${API_URL}/alt-gorevler/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
      body: JSON.stringify({ durum: !d }),
    }).then(() => {
      setAltGorevler(
        altGorevler.map((a) => (a.id === id ? { ...a, durum: !d } : a))
      );
    });
  };

  const altGorevSil = (id) => {
    fetch(`${API_URL}/alt-gorevler/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("wf_token")}` },
    }).then(() => setAltGorevler(altGorevler.filter((a) => a.id !== id)));
  };

  const yorumGonder = () => {
    if (!yeniYorum) return;
    fetch(`${API_URL}/gorevler/${seciliGorev.id}/yorumlar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("wf_token")}`,
      },
      body: JSON.stringify({ mesaj: yeniYorum }),
    })
      .then((r) => r.json())
      .then((y) => {
        const yeniYorumObj = {
          ...y,
          yazan_kisi_adi: aktifKullanici.ad_soyad,
          yazan_kisi_avatar: aktifKullanici.avatar,
        };
        setYorumlar([...yorumlar, yeniYorumObj]);
        setYeniYorum("");
      });
  };

  // --- TAKVİM MANTIĞI (DÜZELTİLEN KISIM) ---
  const takvimGunTikla = (value) => {
    const t = value.format("YYYY-MM-DD");
    const i = gorevler.filter((g) => g.tarih && g.tarih.startsWith(t));
    if (i.length > 0) {
      setSeciliTarih(value.format("DD MMMM YYYY"));
      setSeciliGunIsleri(i);
      setTakvimGunModal(true);
    }
  };

  const takvimCellRender = (value) => {
    const t = value.format("YYYY-MM-DD");
    const l = gorevler.filter((g) => g.tarih && g.tarih.startsWith(t));
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {l.map((i) => (
          <li key={i.id} style={{ marginBottom: 3 }}>
            <Badge
              status={i.durum === "Yapıldı" ? "success" : "warning"}
              text={
                <span style={{ fontSize: 10, whiteSpace: "nowrap" }}>
                  #{i.id} - {i.baslik}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  // --- FİLTRELEME ---
  const filtrelenmisGorevler = gorevler.filter((g) => {
    const metinUyumu =
      (g.baslik || "").toLowerCase().includes(aramaMetni.toLowerCase()) ||
      (g.aciklama || "").toLowerCase().includes(aramaMetni.toLowerCase());
    const durumUyumu = filtreDurum ? g.durum === filtreDurum : true;
    const oncelikUyumu = filtreOncelik ? g.oncelik === filtreOncelik : true;
    const benimIsimMi = sadeceBenim
      ? g.atananlar_listesi?.some((u) => u.id === aktifKullanici.id)
      : true;
    return metinUyumu && durumUyumu && oncelikUyumu && benimIsimMi;
  });

  return (
    <div>
      {/* 1. ÜST FİLTRE ALANI */}
      {viewMode !== "calendar" && (
        <Card
          styles={{ body: { padding: "12px 20px" } }}
          style={{ marginBottom: 16 }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Space wrap>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ara..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  style={{ width: 200 }}
                  allowClear
                />
                <Select
                  placeholder="Durum"
                  style={{ width: 130 }}
                  allowClear
                  onChange={setFiltreDurum}
                  value={filtreDurum}
                >
                  <Option value="Bekliyor">Bekliyor</Option>
                  <Option value="Onay Bekliyor">Onay</Option>
                  <Option value="Yapıldı">Yapıldı</Option>
                </Select>
                <Select
                  placeholder="Öncelik"
                  style={{ width: 120 }}
                  allowClear
                  onChange={setFiltreOncelik}
                  value={filtreOncelik}
                >
                  <Option value="Yüksek">Yüksek</Option>
                  <Option value="Orta">Orta</Option>
                </Select>
                <Checkbox
                  checked={sadeceBenim}
                  onChange={(e) => setSadeceBenim(e.target.checked)}
                >
                  Sadece Benim
                </Checkbox>
                <Button
                  icon={<FilterOutlined />}
                  onClick={() => {
                    setAramaMetni("");
                    setFiltreDurum(null);
                    setFiltreOncelik(null);
                    setSadeceBenim(false);
                  }}
                >
                  Temizle
                </Button>
              </Space>
            </Col>
            <Col>
              <Space>
                {yoneticiMi && (
                  <Button icon={<FolderAddOutlined />} onClick={projeModalAc}>
                    Projeler
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setModalAcik(true)}
                >
                  Yeni İş
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 2. LİSTELEME BİLEŞENİ (GorevListesi.jsx Entegrasyonu) */}
      <GorevListesi
        viewMode={viewMode}
        gorevler={filtrelenmisGorevler}
        yukleniyor={yukleniyor}
        onDetayAc={detayAc}
        onDragEnd={handleDragEnd}
        onTakvimGunTikla={takvimGunTikla}
        takvimCellRender={takvimCellRender}
      />

      {/* 3. YENİ GÖREV MODALI */}
      <Modal
        title="Yeni İş Emri"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          onFinish={formGonder}
          layout="vertical"
          initialValues={{
            oncelik: "Orta",
            atananlar: [aktifKullanici.id],
            tekrar_tipi: "Tek Seferlik",
          }}
        >
          <Form.Item name="proje_id" label="Bağlı Olduğu Proje">
            <Select
              allowClear
              placeholder="Seçiniz"
              showSearch
              optionFilterProp="children"
            >
              {projeler.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.ad} ({p.departman})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="baslik" label="Başlık" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="atananlar" label="Sorumlular">
                <Select mode="multiple" allowClear>
                  {kullanicilar?.map((k) => (
                    <Option key={k.id} value={k.id}>
                      {k.ad_soyad}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tarih" label="Bitiş Tarihi">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={10}>
            <Col span={12}>
              <Form.Item name="oncelik" label="Öncelik">
                <Select>
                  <Option value="Yüksek">Yüksek</Option>
                  <Option value="Orta">Orta</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dosya"
                label="Ek Dosya"
                valuePropName="fileList"
                getValueFromEvent={(e) =>
                  Array.isArray(e) ? e : e && e.fileList
                }
              >
                <Upload beforeUpload={() => false} maxCount={10} multiple>
                  <Button icon={<UploadOutlined />}>Seç</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" block>
            Kaydet
          </Button>
        </Form>
      </Modal>

      {/* 4. DETAY MODALI (Düzeltilen Kısım: İçeriği geri ekledim) */}
      <Modal
        open={detayModalAcik}
        onCancel={() => setDetayModalAcik(false)}
        footer={null}
        width={900}
        centered
        title={`Görev Detayı #${seciliGorev?.id}`}
        destroyOnClose
      >
        {seciliGorev && (
          <Row gutter={24}>
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <Form form={detayForm} layout="vertical">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 15,
                  }}
                >
                  <Tag color="geekblue">{seciliGorev.proje_adi || "Genel"}</Tag>
                  <Space>
                    <Button
                      onClick={() => setDuzenlemeModu(!duzenlemeModu)}
                      icon={duzenlemeModu ? <SaveOutlined /> : <EditOutlined />}
                    >
                      {duzenlemeModu ? "İptal" : "Düzenle"}
                    </Button>
                    <Popconfirm
                      title="Sil?"
                      onConfirm={() => sil(seciliGorev.id)}
                    >
                      <Button danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>

                <Form.Item name="baslik" label="Başlık">
                  <Input
                    style={{ fontWeight: "bold" }}
                    disabled={!duzenlemeModu}
                  />
                </Form.Item>
                <Form.Item name="aciklama" label="Açıklama">
                  <Input.TextArea rows={3} disabled={!duzenlemeModu} />
                </Form.Item>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item name="atananlar" label="Sorumlular">
                      <Select mode="multiple" disabled={!duzenlemeModu}>
                        {kullanicilar?.map((k) => (
                          <Option key={k.id} value={k.id}>
                            {k.ad_soyad}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tarih" label="Bitiş">
                      <DatePicker
                        style={{ width: "100%" }}
                        disabled={!duzenlemeModu}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {duzenlemeModu && (
                  <>
                    <Form.Item
                      name="dosya"
                      label="Dosya Ekle"
                      valuePropName="fileList"
                      getValueFromEvent={(e) =>
                        Array.isArray(e) ? e : e && e.fileList
                      }
                    >
                      <Upload maxCount={5} multiple beforeUpload={() => false}>
                        <Button icon={<UploadOutlined />}>Yeni Dosya</Button>
                      </Upload>
                    </Form.Item>
                    <Button type="primary" block onClick={handleEditClick}>
                      Değişiklikleri Kaydet
                    </Button>
                  </>
                )}
              </Form>

              <div style={{ marginTop: 20 }}>
                <Title level={5}>Ekli Dosyalar</Title>
                {seciliGorevDosyalari.length > 0 ? (
                  <List
                    size="small"
                    dataSource={seciliGorevDosyalari}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <a
                            href={`${API_URL}/uploads/${file.fiziksel_ad}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            İndir
                          </a>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={getFileIcon(file.ad)}
                          title={file.ad}
                        />
                      </List.Item>
                    )}
                  />
                ) : (
                  <div style={{ color: "#999", fontStyle: "italic" }}>
                    Bu görevde dosya yok.
                  </div>
                )}
              </div>

              <Divider style={{ margin: "15px 0" }} />
              <Title level={5}>Alt Görevler</Title>
              <List
                size="small"
                dataSource={altGorevler}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => altGorevSil(item.id)}
                      />,
                    ]}
                  >
                    <Checkbox
                      checked={item.durum}
                      onChange={() => altGorevToggle(item.id, item.durum)}
                      style={{
                        textDecoration: item.durum ? "line-through" : "none",
                      }}
                    >
                      {item.baslik}
                    </Checkbox>
                  </List.Item>
                )}
              />
              <Space.Compact style={{ width: "100%", marginTop: 10 }}>
                <Input
                  placeholder="Alt görev..."
                  value={yeniAltGorev}
                  onChange={(e) => setYeniAltGorev(e.target.value)}
                  onPressEnter={altGorevEkle}
                />
                <Button type="primary" onClick={altGorevEkle}>
                  Ekle
                </Button>
              </Space.Compact>
            </Col>

            <Col span={10}>
              <Title level={5}>
                <MessageOutlined /> Sohbet
              </Title>
              <div
                style={{
                  height: 400,
                  overflowY: "auto",
                  border: "1px solid #f0f0f0",
                  borderRadius: 8,
                  padding: 10,
                  background: "#fafafa",
                }}
              >
                <List
                  dataSource={yorumlar}
                  renderItem={(item) => (
                    <List.Item style={{ padding: "8px 0" }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            src={
                              item.yazan_kisi_avatar
                                ? `${API_URL}/uploads/${item.yazan_kisi_avatar}`
                                : null
                            }
                            style={{ backgroundColor: "#1890ff" }}
                          >
                            {(item.yazan_kisi_adi || "?")[0]}
                          </Avatar>
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text strong>{item.yazan_kisi_adi}</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              {dayjs(item.tarih).format("HH:mm")}
                            </Text>
                          </div>
                        }
                        description={item.mesaj}
                      />
                    </List.Item>
                  )}
                />
              </div>
              <div style={{ marginTop: 10 }}>
                <Mentions
                  rows={2}
                  placeholder="@..."
                  value={yeniYorum}
                  onChange={setYeniYorum}
                  options={kullanicilar?.map((k) => ({
                    value: k.ad_soyad,
                    label: k.ad_soyad,
                  }))}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ marginTop: 5, float: "right" }}
                  onClick={yorumGonder}
                >
                  Gönder
                </Button>
              </div>
            </Col>
          </Row>
        )}
      </Modal>

      {/* 5. TAKVİM DRAWER */}
      <Drawer
        title={seciliTarih}
        placement="right"
        onClose={() => setTakvimGunModal(false)}
        open={takvimGunModal}
      >
        <List
          dataSource={seciliGunIsleri}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  size="small"
                  onClick={() => {
                    setTakvimGunModal(false);
                    detayAc(item);
                  }}
                >
                  Detay
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={`#${item.id} - ${item.baslik}`}
                description={
                  <Tag color={item.durum === "Yapıldı" ? "green" : "blue"}>
                    {item.durum}
                  </Tag>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
