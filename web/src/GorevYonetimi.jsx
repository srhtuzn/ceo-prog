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
  Typography,
  Popconfirm,
  Upload,
  Divider,
  Badge,
  Row,
  Col,
  Progress,
  List,
  Checkbox,
  Avatar,
  Mentions,
  Calendar,
  Tooltip,
  Drawer,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  PaperClipOutlined,
  SearchOutlined,
  FilterOutlined,
  ProjectOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
  SaveOutlined,
  EditOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FolderAddOutlined,
} from "@ant-design/icons";
// DND-KIT IMPORTLARI GÜNCELLENDİ
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import locale from "antd/es/date-picker/locale/tr_TR";

dayjs.locale("tr");

const { Text, Title } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

// --- KANBAN BİLEŞENLERİ ---
const KanbanCard = ({ gorev, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: gorev.id.toString(),
      data: { gorev },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 999 : "auto", // Sürüklerken öne çıkar
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : "grab",
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, marginBottom: 10 }}
      {...listeners}
      {...attributes}
    >
      <div
        onClick={onClick} // Tıklama olayı buraya bağlı
        style={{
          background: "white",
          padding: 12,
          borderRadius: 6,
          cursor: "pointer",
          borderLeft: `4px solid ${
            gorev.oncelik === "Yüksek" ? "#ff4d4f" : "#1890ff"
          }`,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text strong ellipsis>
            {gorev.baslik}
          </Text>
          {gorev.dosya_yolu && (
            <PaperClipOutlined style={{ color: "#1890ff" }} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Avatar.Group maxCount={3} size="small">
            {gorev.atananlar?.map((k, i) => (
              <Tooltip title={k} key={i}>
                <Avatar style={{ backgroundColor: "#87d068" }}>{k[0]}</Avatar>
              </Tooltip>
            ))}
          </Avatar.Group>
          <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
            {dayjs(gorev.tarih).format("DD MMM")}
          </Tag>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ id, title, color, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? "#e6f7ff" : "#f5f5f5",
        padding: 12,
        borderRadius: 8,
        minHeight: "calc(100vh - 220px)",
        transition: "background 0.3s",
      }}
    >
      <div
        style={{
          marginBottom: 15,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Text
          strong
          style={{ textTransform: "uppercase", fontSize: 12, color: "#666" }}
        >
          {title}
        </Text>
        <Tag color={color}>{children.length}</Tag>
      </div>
      {children}
    </div>
  );
};

export default function GorevYonetimi({
  aktifKullanici,
  projeler,
  kullanicilar,
  bildirimler,
  acilacakGorevId,
  viewMode,
  projeModalAc,
}) {
  const [gorevler, setGorevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [formYukleniyor, setFormYukleniyor] = useState(false);

  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDurum, setFiltreDurum] = useState(null);
  const [filtreOncelik, setFiltreOncelik] = useState(null);
  const [sadeceBenim, setSadeceBenim] = useState(false);

  const [modalAcik, setModalAcik] = useState(false);
  const [detayModalAcik, setDetayModalAcik] = useState(false);
  const [duzenlemeModu, setDuzenlemeModu] = useState(false);

  const [takvimGunModal, setTakvimGunModal] = useState(false);
  const [seciliGunIsleri, setSeciliGunIsleri] = useState([]);
  const [seciliTarih, setSeciliTarih] = useState("");

  const [seciliGorev, setSeciliGorev] = useState(null);
  const [altGorevler, setAltGorevler] = useState([]);
  const [yeniAltGorev, setYeniAltGorev] = useState("");
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState("");

  const [form] = Form.useForm();
  const [detayForm] = Form.useForm();

  const YONETICILER = [
    "Genel Müdür",
    "Departman Müdürü",
    "Süpervizör",
    "Yönetici",
  ];
  const yoneticiMi = YONETICILER.includes(aktifKullanici?.rol);

  // --- SENSÖR AYARLARI (DÜZELTME BURADA) ---
  // Fare 10px hareket etmeden sürükleme başlamaz. Böylece tıklama algılanır.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );
  // -----------------------------------------

  useEffect(() => {
    veriCek();
  }, []);
  useEffect(() => {
    if (acilacakGorevId && gorevler.length > 0) {
      const hedef = gorevler.find((g) => g.id === acilacakGorevId);
      if (hedef) detayAc(hedef);
    }
  }, [acilacakGorevId, gorevler]);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/gorevler`)
      .then((res) => res.json())
      .then((data) => {
        setGorevler(Array.isArray(data) ? data : []);
        setYukleniyor(false);
      })
      .catch(() => {
        setGorevler([]);
        setYukleniyor(false);
      });
  };

  const guvenliIslem = (callback) => {
    if (seciliGorev && seciliGorev.durum === "Yapıldı") {
      Modal.confirm({
        title: "Dikkat!",
        content: "Tamamlanmış görevi değiştirirseniz durumu 'Bekliyor'a döner.",
        onOk: () => {
          durumDegistir(seciliGorev.id, "Bekliyor");
          setSeciliGorev({ ...seciliGorev, durum: "Bekliyor" });
          callback();
        },
      });
    } else callback();
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
    fd.append("gozlemciler", JSON.stringify(degerler.gozlemciler || []));
    if (degerler.dosya?.length)
      fd.append("dosya", degerler.dosya[0].originFileObj);

    fetch(`${API_URL}/gorevler`, { method: "POST", body: fd })
      .then((res) => res.json())
      .then((yeni) => {
        setGorevler([...gorevler, yeni]);
        message.success("Kayıt Başarılı");
        setModalAcik(false);
        form.resetFields();
      });
  };

  const gorevGuncelle = async (v) => {
    setFormYukleniyor(true);
    const fd = new FormData();
    fd.append("baslik", v.baslik || seciliGorev.baslik);
    fd.append("aciklama", v.aciklama || "");
    fd.append("oncelik", v.oncelik);
    fd.append("durum", seciliGorev.durum);
    if (v.proje_id) fd.append("proje_id", v.proje_id);
    if (v.tarih) fd.append("tarih", v.tarih.format("YYYY-MM-DD"));
    fd.append("atananlar", JSON.stringify(v.atananlar || []));
    if (v.dosya?.length) fd.append("dosya", v.dosya[0].originFileObj);

    try {
      const res = await fetch(`${API_URL}/gorevler/${seciliGorev.id}`, {
        method: "PUT",
        body: fd,
      });
      if (!res.ok) throw new Error("Hata");
      const guncel = await res.json();
      setGorevler((prev) =>
        prev.map((g) => (g.id === seciliGorev.id ? { ...g, ...guncel } : g))
      );
      setSeciliGorev({ ...seciliGorev, ...guncel });
      setDuzenlemeModu(false);
      message.success("Güncellendi");
    } catch (e) {
      message.error("Hata");
    } finally {
      setFormYukleniyor(false);
    }
  };

  const durumDegistir = (id, d) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: d }),
    }).then(() => {
      setGorevler((prev) =>
        prev.map((g) => (g.id === id ? { ...g, durum: d } : g))
      );
      if (seciliGorev?.id === id)
        setSeciliGorev((prev) => ({ ...prev, durum: d }));
      message.success("Durum güncellendi");
    });
  };
  const sil = (id) => {
    fetch(`${API_URL}/gorevler/${id}`, { method: "DELETE" }).then(() => {
      veriCek();
      message.success("Silindi");
    });
  };

  const detayAc = (kayit) => {
    setSeciliGorev(kayit);
    setDetayModalAcik(true);
    setDuzenlemeModu(false);
    detayForm.setFieldsValue({
      ...kayit,
      tarih: kayit.tarih ? dayjs(kayit.tarih) : null,
      atananlar: kayit.atananlar || [],
      proje_id: kayit.proje_id,
    });
    fetch(`${API_URL}/gorevler/${kayit.id}/yorumlar`)
      .then((r) => r.json())
      .then(setYorumlar);
    fetch(`${API_URL}/gorevler/${kayit.id}/alt-gorevler`)
      .then((r) => r.json())
      .then(setAltGorevler);
  };

  const altGorevEkle = () => {
    if (!yeniAltGorev) return;
    guvenliIslem(() => {
      fetch(`${API_URL}/gorevler/${seciliGorev.id}/alt-gorevler`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baslik: yeniAltGorev,
          olusturan: aktifKullanici.ad_soyad,
        }),
      })
        .then((r) => r.json())
        .then((y) => {
          setAltGorevler([...altGorevler, y]);
          setYeniAltGorev("");
        });
    });
  };
  const altGorevToggle = (id, d) => {
    guvenliIslem(() => {
      fetch(`${API_URL}/alt-gorevler/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durum: !d }),
      }).then(() => {
        setAltGorevler(
          altGorevler.map((a) => (a.id === id ? { ...a, durum: !d } : a))
        );
      });
    });
  };
  const altGorevSil = (id) => {
    guvenliIslem(() => {
      fetch(`${API_URL}/alt-gorevler/${id}`, { method: "DELETE" }).then(() =>
        setAltGorevler(altGorevler.filter((a) => a.id !== id))
      );
    });
  };
  const yorumGonder = () => {
    if (!yeniYorum) return;
    guvenliIslem(() => {
      fetch(`${API_URL}/gorevler/${seciliGorev.id}/yorumlar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yazan_kisi: aktifKullanici.ad_soyad,
          mesaj: yeniYorum,
        }),
      })
        .then((r) => r.json())
        .then((y) => {
          setYorumlar([...yorumlar, y]);
          setYeniYorum("");
        });
    });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    const gorevId = parseInt(active.id);
    const yeniDurum = over.id;
    const gorev = gorevler.find((g) => g.id === gorevId);
    if (!gorev || gorev.durum === yeniDurum) return;
    if (gorev.durum === "Yapıldı")
      Modal.confirm({
        title: "Dikkat",
        content: "Tamamlanan görevi geri almak istiyor musunuz?",
        onOk: () => durumDegistir(gorevId, yeniDurum),
      });
    else durumDegistir(gorevId, yeniDurum);
  };

  const takvimGunTikla = (value) => {
    const tarihStr = value.format("YYYY-MM-DD");
    const isler = gorevler.filter(
      (g) => g.tarih && g.tarih.startsWith(tarihStr)
    );
    if (isler.length > 0) {
      setSeciliTarih(value.format("DD MMMM YYYY, dddd"));
      setSeciliGunIsleri(isler);
      setTakvimGunModal(true);
    }
  };

  const takvimCellRender = (value) => {
    const tarihString = value.format("YYYY-MM-DD");
    const bugunkuIsler = gorevler.filter(
      (g) => g.tarih && g.tarih.startsWith(tarihString)
    );
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {bugunkuIsler.map((item) => (
          <li key={item.id} style={{ marginBottom: 3 }}>
            <Badge
              status={
                item.oncelik === "Yüksek"
                  ? "error"
                  : item.durum === "Yapıldı"
                  ? "success"
                  : "processing"
              }
              text={
                <span
                  style={{
                    fontSize: 10,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "80px",
                    display: "inline-block",
                  }}
                >
                  {item.baslik}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  const filtrelenmisGorevler = gorevler.filter((gorev) => {
    const metinUyumu = gorev.baslik
      .toLowerCase()
      .includes(aramaMetni.toLowerCase());
    const durumUyumu = filtreDurum ? gorev.durum === filtreDurum : true;
    const oncelikUyumu = filtreOncelik ? gorev.oncelik === filtreOncelik : true;
    const benimIsimMi = sadeceBenim
      ? gorev.atananlar?.includes(aktifKullanici.ad_soyad)
      : true;
    return metinUyumu && durumUyumu && oncelikUyumu && benimIsimMi;
  });

  const columns = [
    {
      title: "Proje",
      dataIndex: "proje_adi",
      width: 150,
      render: (ad) =>
        ad ? <Tag color="geekblue">{ad}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => (
        <a onClick={() => detayAc(r)} style={{ fontWeight: 600 }}>
          {t}
        </a>
      ),
    },
    {
      title: "Sorumlular",
      dataIndex: "atananlar",
      width: 120,
      render: (kisiler) => (
        <Avatar.Group maxCount={3} size="small">
          {kisiler?.map((k, i) => (
            <Tooltip title={k} key={i}>
              <Avatar style={{ backgroundColor: "#87d068" }}>{k[0]}</Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: "Bitiş Tarihi",
      dataIndex: "tarih",
      width: 130,
      sorter: (a, b) => dayjs(a.tarih).unix() - dayjs(b.tarih).unix(),
      render: (t) => {
        if (!t) return "-";
        const tarih = dayjs(t);
        const kalanGun = tarih.diff(dayjs(), "day");
        let renk = "default";
        if (kalanGun < 0) renk = "error";
        else if (kalanGun <= 3) renk = "warning";
        else renk = "success";

        return (
          <Tooltip title={`${kalanGun} gün kaldı`}>
            <Tag color={renk} icon={<ClockCircleOutlined />}>
              {tarih.format("DD MMM")}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Durum",
      dataIndex: "durum",
      width: 120,
      render: (d) => (
        <Tag
          color={
            d === "Yapıldı" ? "green" : d === "Onay Bekliyor" ? "gold" : "blue"
          }
        >
          {d}
        </Tag>
      ),
    },
    {
      title: "Öncelik",
      dataIndex: "oncelik",
      width: 90,
      render: (o) => <Tag color={o === "Yüksek" ? "red" : "blue"}>{o}</Tag>,
    },
    {
      title: "İşlem",
      width: 100,
      align: "center",
      render: (_, r) => (
        <Button
          size="small"
          type="link"
          icon={<EditOutlined />}
          onClick={() => detayAc(r)}
        />
      ),
    },
  ];

  return (
    <div>
      {viewMode !== "calendar" && (
        <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 12 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space wrap>
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Ara..."
                  value={aramaMetni}
                  onChange={(e) => setAramaMetni(e.target.value)}
                  style={{ width: 180 }}
                  allowClear
                />
                <Select
                  placeholder="Durum"
                  style={{ width: 120 }}
                  allowClear
                  onChange={setFiltreDurum}
                  value={filtreDurum}
                >
                  <Option value="Bekliyor">Bekliyor</Option>
                  <Option value="Onay Bekliyor">Onay Bekliyor</Option>
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
                  Sadece Benim İşlerim
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
                  <Button
                    icon={<FolderAddOutlined />}
                    onClick={() => projeModalAc()}
                  >
                    Yeni Proje
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

      {viewMode === "list" && (
        <Table
          columns={columns}
          dataSource={filtrelenmisGorevler}
          rowKey="id"
          loading={yukleniyor}
          pagination={{ pageSize: 10 }}
        />
      )}

      {viewMode === "board" && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <Row gutter={16} style={{ height: "100%" }}>
            <Col span={8}>
              <KanbanColumn id="Bekliyor" title="YAPILACAKLAR" color="blue">
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Bekliyor")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                    />
                  ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn
                id="Onay Bekliyor"
                title="ONAY / İŞLEMDE"
                color="gold"
              >
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Onay Bekliyor")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                    />
                  ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn id="Yapıldı" title="TAMAMLANANLAR" color="green">
                {filtrelenmisGorevler
                  .filter((g) => g.durum === "Yapıldı")
                  .map((g) => (
                    <KanbanCard
                      key={g.id}
                      gorev={g}
                      onClick={() => detayAc(g)}
                    />
                  ))}
              </KanbanColumn>
            </Col>
          </Row>
        </DndContext>
      )}

      {viewMode === "calendar" && (
        <Calendar
          locale={locale}
          cellRender={takvimCellRender}
          onSelect={takvimGunTikla}
        />
      )}

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
            atananlar: [aktifKullanici.ad_soyad],
            tekrar_tipi: "Tek Seferlik",
          }}
        >
          <Form.Item name="proje_id" label="Proje">
            <Select allowClear placeholder="Seçiniz">
              {projeler?.map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.ad}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="baslik" label="Başlık" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="atananlar" label="Sorumlular">
            <Select mode="multiple" allowClear>
              {kullanicilar?.map((k) => (
                <Option key={k.id} value={k.ad_soyad}>
                  {k.ad_soyad}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="gozlemciler" label="Gözlemciler">
            <Select mode="multiple">
              {kullanicilar?.map((k) => (
                <Option key={k.id} value={k.ad_soyad}>
                  {k.ad_soyad}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={10}>
            <Col span={8}>
              <Form.Item name="oncelik" label="Öncelik">
                <Select>
                  <Option value="Yüksek">Yüksek</Option>
                  <Option value="Orta">Orta</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tarih" label="Bitiş">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tekrar_tipi" label="Tekrar">
                <Select>
                  <Option value="Tek Seferlik">Yok</Option>
                  <Option value="Günlük">Günlük</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="dosya" label="Ek Dosya">
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadOutlined />}>Seç</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Kaydet
          </Button>
        </Form>
      </Modal>

      <Modal
        open={detayModalAcik}
        onCancel={() => setDetayModalAcik(false)}
        footer={null}
        width={900}
        centered
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingRight: 30,
            }}
          >
            {duzenlemeModu ? (
              <Input defaultValue={seciliGorev?.baslik} onChange={(e) => {}} />
            ) : (
              <span style={{ fontSize: 18 }}>{seciliGorev?.baslik}</span>
            )}
            <Space>
              <Button
                onClick={() => setDuzenlemeModu(!duzenlemeModu)}
                icon={duzenlemeModu ? <SaveOutlined /> : <EditOutlined />}
              >
                {duzenlemeModu ? "Vazgeç" : "Düzenle"}
              </Button>
              <Tag color="blue">{seciliGorev?.durum}</Tag>
            </Space>
          </div>
        }
      >
        {seciliGorev && (
          <Row gutter={24}>
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <Form
                form={detayForm}
                layout="vertical"
                initialValues={seciliGorev}
                disabled={!duzenlemeModu}
              >
                <div style={{ marginBottom: 15 }}>
                  <Text type="secondary">Proje: </Text>
                  <Tag color="geekblue">{seciliGorev.proje_adi || "Genel"}</Tag>
                </div>
                <Form.Item name="aciklama" label="Açıklama">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item name="atananlar" label="Sorumlular">
                      <Select mode="multiple">
                        {kullanicilar?.map((k) => (
                          <Option key={k.id} value={k.ad_soyad}>
                            {k.ad_soyad}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="tarih" label="Bitiş">
                      <DatePicker style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                </Row>
                {duzenlemeModu && (
                  <Button
                    type="primary"
                    block
                    onClick={() => gorevGuncelle(detayForm.getFieldsValue())}
                  >
                    Kaydet
                  </Button>
                )}
              </Form>

              {!duzenlemeModu && seciliGorev.dosya_yolu && (
                <Button
                  type="dashed"
                  block
                  icon={<PaperClipOutlined />}
                  style={{ marginTop: 10 }}
                  href={`${API_URL}/uploads/${seciliGorev.dosya_yolu}`}
                  target="_blank"
                >
                  Dosyayı Aç
                </Button>
              )}
              <Divider />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Title level={5}>Alt Görevler</Title>
                <Text type="secondary">
                  {Math.round(
                    (altGorevler.filter((x) => x.durum).length /
                      (altGorevler.length || 1)) *
                      100
                  )}
                  %
                </Text>
              </div>
              <Progress
                percent={Math.round(
                  (altGorevler.filter((x) => x.durum).length /
                    (altGorevler.length || 1)) *
                    100
                )}
                strokeColor="#87d068"
                showInfo={false}
              />
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
                        color: item.durum ? "#ccc" : "inherit",
                      }}
                    >
                      {item.baslik}
                    </Checkbox>
                  </List.Item>
                )}
              />
              <Space.Compact style={{ width: "100%", marginTop: 10 }}>
                <Input
                  placeholder="Alt görev ekle"
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
              <Title level={5}>İş Sohbeti</Title>
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
                          <Avatar style={{ backgroundColor: "#1890ff" }}>
                            {item.yazan_kisi[0]}
                          </Avatar>
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text strong>{item.yazan_kisi}</Text>
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              {dayjs(item.tarih).format("DD.MM HH:mm")}
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
                  placeholder="@isim..."
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

      <Drawer
        title={seciliTarih}
        placement="right"
        onClose={() => setTakvimGunModal(false)}
        open={takvimGunModal}
        width={400}
      >
        <List
          itemLayout="horizontal"
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
                avatar={
                  <Avatar
                    style={{
                      backgroundColor:
                        item.oncelik === "Yüksek" ? "#ff4d4f" : "#1890ff",
                    }}
                  >
                    {item.baslik[0]}
                  </Avatar>
                }
                title={item.baslik}
                description={<Tag>{item.durum}</Tag>}
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
