import { useState, useEffect } from "react";
import {
  Table,
  Button,
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
  Tag,
  Calendar,
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
  ClockCircleOutlined,
  CheckSquareOutlined,
  CloseOutlined,
  MessageOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import dayjs from "dayjs";

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
        zIndex: 999,
        opacity: 0.8,
        cursor: "grabbing",
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
        style={{
          background: "white",
          padding: 12,
          borderRadius: 6,
          cursor: "grab",
          borderLeft: `4px solid ${
            gorev.oncelik === "Yüksek"
              ? "#ff4d4f"
              : gorev.oncelik === "Orta"
              ? "#faad14"
              : "#1890ff"
          }`,
          boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
        }}
        onClick={onClick}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <Text strong style={{ fontSize: 13 }} ellipsis>
            {gorev.baslik}
          </Text>
          {gorev.dosya_yolu && (
            <PaperClipOutlined style={{ color: "#1890ff", fontSize: 12 }} />
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space size={2}>
            {gorev.atananlar?.slice(0, 3).map((k, i) => (
              <Avatar
                key={i}
                size={20}
                style={{ backgroundColor: "#87d068", fontSize: 10 }}
              >
                {k[0]}
              </Avatar>
            ))}
          </Space>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {gorev.tarih ? dayjs(gorev.tarih).format("DD.MM") : ""}
          </Text>
        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ id, title, color, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: id });
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
          alignItems: "center",
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

// --- ANA BİLEŞEN (viewMode eklendi) ---
export default function GorevYonetimi({
  aktifKullanici,
  projeler,
  kullanicilar,
  bildirimler,
  acilacakGorevId,
  viewMode,
}) {
  const [gorevler, setGorevler] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [aramaMetni, setAramaMetni] = useState("");
  const [filtreDurum, setFiltreDurum] = useState(null);
  const [filtreOncelik, setFiltreOncelik] = useState(null);

  const [modalAcik, setModalAcik] = useState(false);
  const [detayModalAcik, setDetayModalAcik] = useState(false);

  const [seciliGorev, setSeciliGorev] = useState(null);
  const [altGorevler, setAltGorevler] = useState([]);
  const [yeniAltGorev, setYeniAltGorev] = useState("");
  const [yorumlar, setYorumlar] = useState([]);
  const [yeniYorum, setYeniYorum] = useState("");

  const [form] = Form.useForm();
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
      const hedef = gorevler.find((g) => g.id === acilacakGorevId);
      if (hedef) detayAc(hedef);
    }
  }, [acilacakGorevId, gorevler]);

  const veriCek = () => {
    setYukleniyor(true);
    fetch(`${API_URL}/gorevler`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setGorevler(data);
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
        content: (
          <div>
            <p>Bu görev tamamlanmış.</p>
            <p>Değişiklik yaparsanız 'Bekliyor' durumuna dönecektir.</p>
          </div>
        ),
        onOk: () => {
          durumDegistir(seciliGorev.id, "Bekliyor");
          setSeciliGorev({ ...seciliGorev, durum: "Bekliyor" });
          callback();
        },
      });
    } else {
      callback();
    }
  };

  const formGonder = (degerler) => {
    const formData = new FormData();
    formData.append("baslik", degerler.baslik);
    formData.append("aciklama", degerler.aciklama || "");
    formData.append("oncelik", degerler.oncelik || "Orta");
    formData.append("tekrar_tipi", degerler.tekrar_tipi || "Tek Seferlik");
    if (degerler.proje_id) formData.append("proje_id", degerler.proje_id);
    if (degerler.tarih)
      formData.append("tarih", degerler.tarih.format("YYYY-MM-DD"));
    formData.append("atananlar", JSON.stringify(degerler.atananlar || []));
    formData.append("gozlemciler", JSON.stringify(degerler.gozlemciler || []));
    if (degerler.dosya && degerler.dosya.length > 0)
      formData.append("dosya", degerler.dosya[0].originFileObj);

    fetch(`${API_URL}/gorevler`, { method: "POST", body: formData })
      .then((res) => res.json())
      .then((yeni) => {
        setGorevler([...gorevler, yeni]);
        message.success("Kayıt Başarılı!");
        setModalAcik(false);
        form.resetFields();
      });
  };

  const durumDegistir = (id, yeniDurum) => {
    fetch(`${API_URL}/gorevler/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durum: yeniDurum }),
    }).then(() => {
      setGorevler((prev) =>
        prev.map((g) => (g.id === id ? { ...g, durum: yeniDurum } : g))
      );
      message.success(`Durum güncellendi: ${yeniDurum}`);
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
    fetch(`${API_URL}/gorevler/${kayit.id}/yorumlar`)
      .then((res) => res.json())
      .then((data) => setYorumlar(data));
    fetch(`${API_URL}/gorevler/${kayit.id}/alt-gorevler`)
      .then((res) => res.json())
      .then((data) => setAltGorevler(data));
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
        .then((res) => res.json())
        .then((yeni) => {
          setAltGorevler([...altGorevler, yeni]);
          setYeniAltGorev("");
          message.success("Eklendi");
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
          altGorevler.map((ag) => (ag.id === id ? { ...ag, durum: !d } : ag))
        );
      });
    });
  };
  const altGorevSil = (id) => {
    guvenliIslem(() => {
      fetch(`${API_URL}/alt-gorevler/${id}`, { method: "DELETE" }).then(() =>
        setAltGorevler(altGorevler.filter((ag) => ag.id !== id))
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
        .then((res) => res.json())
        .then((yeni) => {
          setYorumlar([...yorumlar, yeni]);
          setYeniYorum("");
        });
    });
  };
  const handleDragEnd = (e) => {
    const { active, over } = e;
    if (!over) return;
    const id = parseInt(active.id);
    const d = over.id;
    const g = gorevler.find((x) => x.id === id);
    if (!g || g.durum === d) return;
    if (g.durum === "Yapıldı") {
      Modal.confirm({
        title: "Dikkat",
        content: "Tamamlanmış görevi değiştiriyorsunuz.",
        onOk: () => durumDegistir(id, d),
      });
    } else {
      durumDegistir(id, d);
    }
  };

  const takvimCellRender = (value, info) => {
    if (info.type !== "date") return info.originNode;
    const tStr = value.format("YYYY-MM-DD");
    const bugun = gorevler.filter((g) => g.tarih && g.tarih.startsWith(tStr));
    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {bugun.map((item) => (
          <li key={item.id}>
            <Badge
              status={
                item.oncelik === "Yüksek"
                  ? "error"
                  : item.durum === "Yapıldı"
                  ? "success"
                  : "processing"
              }
              text={item.baslik}
              style={{ fontSize: "10px" }}
            />
          </li>
        ))}
      </ul>
    );
  };

  const filtrelenmis = gorevler.filter((g) => {
    const m = g.baslik.toLowerCase().includes(aramaMetni.toLowerCase());
    const d = filtreDurum ? g.durum === filtreDurum : true;
    const o = filtreOncelik ? g.oncelik === filtreOncelik : true;
    return m && d && o;
  });

  const columns = [
    {
      title: "Proje",
      dataIndex: "proje_adi",
      render: (ad) =>
        ad ? <Tag color="cyan">{ad}</Tag> : <Text type="secondary">-</Text>,
    },
    {
      title: "Başlık",
      dataIndex: "baslik",
      render: (t, r) => {
        const ok =
          bildirimler &&
          bildirimler.some((b) => b.gorev_id === r.id && !b.okundu);
        return (
          <Badge dot={ok} offset={[5, 0]}>
            <a
              onClick={() => detayAc(r)}
              style={{ fontWeight: ok ? "bold" : "normal", color: "#1890ff" }}
            >
              {t}
            </a>
          </Badge>
        );
      },
    },
    {
      title: "Rolüm",
      key: "rolum",
      width: 100,
      render: (_, r) => {
        if (r.atananlar?.includes(aktifKullanici.ad_soyad))
          return <Tag color="blue">Sorumlu</Tag>;
        if (r.gozlemciler?.includes(aktifKullanici.ad_soyad))
          return <Tag color="gold">Gözlemci</Tag>;
        if (yoneticiMi) return <Tag color="purple">Yönetici</Tag>;
        return "-";
      },
    },
    {
      title: "Durum",
      dataIndex: "durum",
      render: (d) => <Tag color={d === "Yapıldı" ? "green" : "blue"}>{d}</Tag>,
    },
    {
      title: "Öncelik",
      dataIndex: "oncelik",
      render: (o) => <Tag color={o === "Yüksek" ? "red" : "blue"}>{o}</Tag>,
    },
    {
      title: "Ek",
      dataIndex: "dosya_yolu",
      align: "center",
      render: (yol) =>
        yol ? (
          <PaperClipOutlined style={{ color: "#1890ff", fontSize: 18 }} />
        ) : (
          "-"
        ),
    },
    {
      title: "İşlem",
      width: 200,
      render: (_, r) => (
        <Space>
          {r.durum === "Bekliyor" &&
            r.atananlar?.includes(aktifKullanici.ad_soyad) && (
              <Button
                size="small"
                type="primary"
                onClick={() => durumDegistir(r.id, "Onay Bekliyor")}
              >
                Tamamla
              </Button>
            )}
          {r.durum === "Onay Bekliyor" && yoneticiMi && (
            <>
              <Button
                size="small"
                type="primary"
                onClick={() => durumDegistir(r.id, "Yapıldı")}
              >
                Onayla
              </Button>
              <Button
                size="small"
                danger
                onClick={() => durumDegistir(r.id, "Bekliyor")}
              >
                Reddet
              </Button>
            </>
          )}
          {r.durum === "Yapıldı" && yoneticiMi && (
            <Button
              size="small"
              onClick={() => durumDegistir(r.id, "Bekliyor")}
            >
              Geri Al
            </Button>
          )}
          {yoneticiMi && (
            <Popconfirm title="Sil?" onConfirm={() => sil(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const kanbanData = {
    Bekliyor: filtrelenmis.filter((g) => g.durum === "Bekliyor"),
    "Onay Bekliyor": filtrelenmis.filter((g) => g.durum === "Onay Bekliyor"),
    Yapıldı: filtrelenmis.filter((g) => g.durum === "Yapıldı"),
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 8,
        minHeight: "80vh",
      }}
    >
      {/* ÜST ARAÇ ÇUBUĞU (Filtreler ve Yeni Ekle) */}
      {viewMode !== "calendar" && (
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space wrap>
            <Input
              placeholder="Ara..."
              prefix={<SearchOutlined style={{ color: "#ccc" }} />}
              style={{ width: 200 }}
              value={aramaMetni}
              onChange={(e) => setAramaMetni(e.target.value)}
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
            {(aramaMetni || filtreDurum || filtreOncelik) && (
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setAramaMetni("");
                  setFiltreDurum(null);
                  setFiltreOncelik(null);
                }}
              >
                Temizle
              </Button>
            )}
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalAcik(true)}
          >
            Yeni İş
          </Button>
        </div>
      )}

      {/* --- 1. LİSTE GÖRÜNÜMÜ --- */}
      {viewMode === "list" && (
        <Table
          columns={columns}
          dataSource={filtrelenmis}
          rowKey="id"
          loading={yukleniyor}
          pagination={{ pageSize: 10 }}
        />
      )}

      {/* --- 2. PANO (KANBAN) GÖRÜNÜMÜ --- */}
      {viewMode === "board" && (
        <DndContext onDragEnd={handleDragEnd}>
          <Row gutter={16} style={{ height: "100%" }}>
            <Col span={8}>
              <KanbanColumn id="Bekliyor" title="YAPILACAKLAR" color="blue">
                {kanbanData["Bekliyor"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn
                id="Onay Bekliyor"
                title="ONAY / İŞLEMDE"
                color="gold"
              >
                {kanbanData["Onay Bekliyor"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
            <Col span={8}>
              <KanbanColumn id="Yapıldı" title="TAMAMLANANLAR" color="green">
                {kanbanData["Yapıldı"].map((g) => (
                  <KanbanCard key={g.id} gorev={g} onClick={() => detayAc(g)} />
                ))}
              </KanbanColumn>
            </Col>
          </Row>
        </DndContext>
      )}

      {/* --- 3. TAKVİM GÖRÜNÜMÜ --- */}
      {viewMode === "calendar" && <Calendar cellRender={takvimCellRender} />}

      {/* --- MODALLAR --- */}
      <Modal
        title="Yeni İş Emri"
        open={modalAcik}
        onCancel={() => setModalAcik(false)}
        footer={null}
        destroyOnClose={true}
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
            <Select placeholder="Seçiniz" allowClear>
              {projeler &&
                projeler.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.ad}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="baslik" label="Başlık" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: "flex", gap: 10 }}>
            <Form.Item name="atananlar" label="Sorumlu" style={{ flex: 1 }}>
              <Select mode="multiple">
                {kullanicilar &&
                  kullanicilar.map((k) => (
                    <Option key={k.id} value={k.ad_soyad}>
                      {k.ad_soyad}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
            <Form.Item name="tarih" label="Tarih" style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
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
      >
        {/* Detay İçeriği (Kısaltıldı, önceki kodunuzdaki detay içeriği buraya gelecek. Eğer isterseniz tam halini veririm ama dosya çok uzuyor.) */}
        {/* Buraya kopyala-yapıştır ile eski detay içeriğini koyabilirsiniz veya ben size tam halini verebilirim */}
        {seciliGorev && (
          <Row gutter={24}>
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <div style={{ marginBottom: 20 }}>
                <Text type="secondary">
                  <ProjectOutlined /> Proje:
                </Text>{" "}
                <strong style={{ color: "#1890ff" }}>
                  {seciliGorev.proje_adi || "Genel"}
                </strong>
                <Divider type="vertical" />
                <Text type="secondary">
                  <ClockCircleOutlined /> Tekrar:
                </Text>{" "}
                <strong>{seciliGorev.tekrar_tipi || "Tek Seferlik"}</strong>
              </div>
              <div
                style={{
                  background: "#fafafa",
                  padding: 15,
                  borderRadius: 8,
                  marginBottom: 20,
                }}
              >
                <Text type="secondary">Açıklama:</Text>
                <p>{seciliGorev.aciklama || "Açıklama girilmemiş."}</p>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text type="secondary">Sorumlular:</Text>
                    <br />
                    {seciliGorev.atananlar?.map((k) => (
                      <Tag key={k} color="purple">
                        {k}
                      </Tag>
                    )) || "-"}
                  </Col>
                  <Col span={12}>
                    <Text type="secondary">Bitiş Tarihi:</Text>
                    <br />
                    <strong>
                      {seciliGorev.tarih
                        ? dayjs(seciliGorev.tarih).format("DD.MM.YYYY")
                        : "-"}
                    </strong>
                  </Col>
                </Row>
                {seciliGorev.dosya_yolu && (
                  <div style={{ marginTop: 15 }}>
                    <Button
                      type="dashed"
                      block
                      icon={<PaperClipOutlined />}
                      href={`${API_URL}/uploads/${seciliGorev.dosya_yolu}`}
                      target="_blank"
                    >
                      Ekli Dosyayı Görüntüle
                    </Button>
                  </div>
                )}
              </div>
              <div
                style={{
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Title level={5} style={{ margin: 0 }}>
                  <CheckSquareOutlined /> Alt Görevler / İş Listesi
                </Title>
                <span style={{ color: "#999", fontSize: 12 }}>
                  {Math.round(
                    (altGorevler.filter((x) => x.durum).length /
                      (altGorevler.length || 1)) *
                      100
                  )}
                  % Tamamlandı
                </span>
              </div>
              <Progress
                percent={Math.round(
                  (altGorevler.filter((x) => x.durum).length /
                    (altGorevler.length || 1)) *
                    100
                )}
                strokeColor="#87d068"
                showInfo={false}
                style={{ marginBottom: 15 }}
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
                    >
                      <span
                        style={{
                          textDecoration: item.durum ? "line-through" : "none",
                          color: item.durum ? "#ccc" : "black",
                        }}
                      >
                        {item.baslik}
                      </span>
                    </Checkbox>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#ccc",
                        marginLeft: "auto",
                      }}
                    >
                      {item.olusturan}
                    </span>
                  </List.Item>
                )}
              />
              {(yoneticiMi ||
                seciliGorev.atananlar?.includes(aktifKullanici.ad_soyad)) && (
                <Space.Compact style={{ width: "100%", marginTop: 10 }}>
                  <Input
                    placeholder="Yeni alt adım ekle"
                    value={yeniAltGorev}
                    onChange={(e) => setYeniAltGorev(e.target.value)}
                    onPressEnter={altGorevEkle}
                  />
                  <Button type="primary" onClick={altGorevEkle}>
                    Ekle
                  </Button>
                </Space.Compact>
              )}
            </Col>
            <Col span={10}>
              <Title level={5}>
                <MessageOutlined /> İş Sohbeti
              </Title>
              <div
                style={{
                  height: "400px",
                  overflowY: "auto",
                  border: "1px solid #eee",
                  padding: 10,
                  borderRadius: 5,
                  marginBottom: 10,
                  background: "#fff",
                }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={yorumlar}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ backgroundColor: "#1890ff" }}>
                            {item.yazan_kisi ? item.yazan_kisi[0] : "U"}
                          </Avatar>
                        }
                        title={
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <Text strong>{item.yazan_kisi}</Text>{" "}
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
                {yorumlar.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#ccc",
                      marginTop: 50,
                    }}
                  >
                    Henüz mesaj yok.
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <Mentions
                  rows={2}
                  placeholder="Yorum yaz... (@ ile etiketle)"
                  value={yeniYorum}
                  onChange={(text) => setYeniYorum(text)}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      yorumGonder();
                    }
                  }}
                  options={
                    kullanicilar &&
                    kullanicilar.map((k) => ({
                      value: k.ad_soyad,
                      label: k.ad_soyad,
                      key: k.id,
                    }))
                  }
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={yorumGonder}
                  style={{ marginTop: 10, float: "right" }}
                >
                  Gönder
                </Button>
              </div>
            </Col>
          </Row>
        )}
      </Modal>
    </div>
  );
}
