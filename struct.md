graph TB
    subgraph "前端层 (Frontend Layer)"
        FE[FastUploader React组件]
        FE2[AntUploader React组件]
        UM[UploadManager]
        FE --> UM
        FE2 --> UM
    end
    
    subgraph "API契约层 (API Contract Layer)"
        API1["POST /verify<br/>验证文件"]
        API2["POST /upload<br/>上传分片"]
        API3["POST /merge<br/>合并分片"]
    end
    
    subgraph "后端实现层 (Backend Implementation Layer)"
        subgraph "Java Spring Boot Starter"
            JAVA[FileUploadController]
            JSERVICE[FileUploadService]
            JCONFIG[BigUploadProperties]
            JAVA --> JSERVICE
            JSERVICE --> JCONFIG
        end
        
        subgraph "Python FastAPI Package"
            PYTHON[create_upload_router]
            PSERVICE[UploadService]
            PCONFIG[UploadConfig]
            PYTHON --> PSERVICE
            PSERVICE --> PCONFIG
        end
        
        subgraph "Node.js Express"
            NODE[Express Routes]
            NSERVICE[Upload Logic]
            NODE --> NSERVICE
        end
    end
    
    subgraph "存储层 (Storage Layer)"
        STORAGE[文件系统存储]
        TEMP[临时分片存储]
        STORAGE --> TEMP
    end
    
    UM -.-> API1
    UM -.-> API2
    UM -.-> API3
    
    API1 --> JAVA
    API2 --> JAVA
    API3 --> JAVA
    
    API1 --> PYTHON
    API2 --> PYTHON
    API3 --> PYTHON
    
    API1 --> NODE
    API2 --> NODE
    API3 --> NODE
    
    JSERVICE --> STORAGE
    PSERVICE --> STORAGE
    NSERVICE --> STORAGE
    
    style FE fill:#e1f5fe
    style FE2 fill:#e1f5fe
    style API1 fill:#f3e5f5
    style API2 fill:#f3e5f5
    style API3 fill:#f3e5f5
    style JAVA fill:#e8f5e8
    style PYTHON fill:#fff3e0
    style NODE fill:#fce4ec