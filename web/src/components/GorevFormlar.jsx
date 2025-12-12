import React from "react";
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
  Tag,
  Space,
  Popconfirm,
  List,
  Checkbox,
  Avatar,
  Mentions,
  Divider,
  Typography,
} from "antd";
import {
  UploadOutlined,
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

const { Title, Text } = Typography;
const { Option } = Select;
const API_URL = "http://localhost:3000";

// Dosya İkonu Yardımcısı
const getFileIcon = (fileName) => {
  if (!fileName) return <FileOutlined />;
  if (fileName.endsWith(".pdf"))
    return <FilePdfOutlined style={{ color: "red" }} />;
  if (fileName.match(/\.(jpg|jpeg|png|gif)$/))
    return <FileImageOutlined style={{ color: "purple" }} />;
  return <FileOutlined />;
};

export default function GorevFormlar({
  // Props
  createModalOpen,
  setCreateModalOpen,
  onCreateFinish,
  createForm,
  detailModalOpen,
  setDetailModalOpen,
  selectedTask,
  isEditMode,
  setIsEditMode,
  onUpdate,
  onDelete,
  // Data Props
  projects,
  users,
  taskFiles,
  comments,
  subtasks,
  // Actions
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddComment,
  newSubtask,
  setNewSubtask,
  newComment,
  setNewComment,
  activeUser,
}) {
  return (
    <>
      {/* 1. YENİ GÖREV OLUŞTURMA MODALI */}
      <Modal
        title="Yeni İş Emri"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          onFinish={onCreateFinish}
          layout="vertical"
          initialValues={{
            oncelik: "Orta",
            atananlar: [activeUser.id],
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
              {projects.map((p) => (
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
                  {users.map((k) => (
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
          <Button type="primary" htmlType="submit" block size="large">
            Kaydet
          </Button>
        </Form>
      </Modal>

      {/* 2. DETAY MODALI */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={900}
        centered
        title={`Görev Detayı #${selectedTask?.id}`}
        destroyOnClose
      >
        {selectedTask && (
          <Row gutter={24}>
            {/* SOL TARAF: FORM */}
            <Col span={14} style={{ borderRight: "1px solid #f0f0f0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 15,
                }}
              >
                <Tag color="geekblue">{selectedTask.proje_adi || "Genel"}</Tag>
                <Space>
                  <Button
                    onClick={() => setIsEditMode(!isEditMode)}
                    icon={isEditMode ? <SaveOutlined /> : <EditOutlined />}
                  >
                    {isEditMode ? "İptal" : "Düzenle"}
                  </Button>
                  <Popconfirm
                    title="Sil?"
                    onConfirm={() => onDelete(selectedTask.id)}
                  >
                    <Button danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>

              {/* Düzenleme Formu (Parent'tan gelen değerlerle çalışır, form instance'ı parentta olabilir ama burada izole de edilebilir. 
                  Basitlik için burada manuel inputlar kullanabiliriz veya parent'tan form ref geçebiliriz. 
                  Bu örnekte parent'taki 'detayForm' hook'unu kullanmak için props ile almalıydık ama
                  burada state yönetimi daha kolay olsun diye direkt input/select render ediyoruz.) 
              */}
              {/* NOT: Ant Design Form.Item içinde initialValue dinamik değişince render sorunu olmaması için 
                  GorevYonetimi.jsx içindeki detayForm'u buraya prop olarak geçmeliyiz. 
                  Aşağıda 'detayForm' prop olarak bekleniyor. */}

              <Form form={createForm} layout="vertical" component={false}>
                {/* Burası trick: createForm yerine detailForm prop'u gelmeli. 
                     Ancak biz GorevYonetimi'ndeki detayForm'u kullanacağız. */}
              </Form>
              {/* Form yapısını GorevYonetimi.jsx içinde tutup buraya sadece children olarak da geçebilirdik. 
                  Ancak yapıyı bozmamak için GorevYonetimi.jsx içinde detayForm'u buraya prop geçeceğiz. */}
            </Col>

            {/* SAĞ TARAF: SOHBET & LOG */}
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
                  dataSource={comments}
                  renderItem={(item) => (
                    <List.Item style={{ padding: "8px 0" }}>
                      <List.Item.Meta
                        avatar={
                          item.yazan_kisi_avatar ? (
                            <Avatar
                              src={`${API_URL}/uploads/${item.yazan_kisi_avatar}`}
                            />
                          ) : (
                            <Avatar style={{ backgroundColor: "#1890ff" }}>
                              {(item.yazan_kisi_adi || "?")[0]}
                            </Avatar>
                          )
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
                  value={newComment}
                  onChange={setNewComment}
                  options={users?.map((k) => ({
                    value: k.ad_soyad,
                    label: k.ad_soyad,
                  }))}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  style={{ marginTop: 5, float: "right" }}
                  onClick={onAddComment}
                >
                  Gönder
                </Button>
              </div>
            </Col>
          </Row>
        )}
      </Modal>
    </>
  );
}
