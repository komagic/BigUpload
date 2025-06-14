import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosProgressEvent,
} from "axios";
import { UploadError } from "@bigupload/shared";

// 直接在本地定义错误类型，避免导入问题
enum UploadErrorType {
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  ABORT_ERROR = "ABORT_ERROR",
  HASH_CALCULATION_ERROR = "HASH_CALCULATION_ERROR",
}

export class RequestManager {
  private instance: AxiosInstance;

  constructor(baseURL: string) {
    this.instance = axios.create({
      baseURL,
      timeout: 60000,
    });

    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: any) => {
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: any) => {
        // 如果服务器返回了数据，但是状态是失败的
        if (response.data && response.data.success === false) {
          const errorData: UploadError = {
            type: UploadErrorType.SERVER_ERROR,
            message: response.data.message || "服务器返回错误",
            retryable: true,
          };
          return Promise.reject(errorData);
        }
        return response.data;
      },
      (error: any) => {
        let errorData: UploadError = {
          type: UploadErrorType.NETWORK_ERROR,
          message: "网络请求失败",
          retryable: true,
        };

        if (error.response) {
          // 服务器返回错误
          errorData.type = UploadErrorType.SERVER_ERROR;
          errorData.message = `服务器错误: ${error.response.status}`;

          // 尝试从响应中获取更详细的错误信息
          if (error.response.data && error.response.data.message) {
            errorData.message = error.response.data.message;
          }
        } else if (error.request) {
          // 请求超时
          if (error.code === "ECONNABORTED") {
            errorData.type = UploadErrorType.TIMEOUT_ERROR;
            errorData.message = "请求超时";
          }
        } else if (error.message && error.message.includes("aborted")) {
          // 请求被取消
          errorData.type = UploadErrorType.ABORT_ERROR;
          errorData.message = "请求已取消";
          errorData.retryable = false;
        }

        return Promise.reject(errorData);
      }
    );
  }

  /**
   * 发送GET请求
   */
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.instance.get<T>(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 发送POST请求
   */
  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.instance.post<T>(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 上传分片文件
   */
  async uploadChunk<T>(
    url: string,
    chunk: Blob,
    params: Record<string, string | number>,
    config?: AxiosRequestConfig,
    onProgress?: (progressEvent: AxiosProgressEvent) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append("chunk", chunk);

    // 添加其他参数
    Object.entries(params).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    console.log(`准备上传分片到 ${url}，参数:`, params);

    const uploadConfig: AxiosRequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: onProgress,
    };

    try {
      console.log(`开始发送分片上传请求，大小: ${chunk.size}字节`);
      const response = await this.instance.post<T>(url, formData, uploadConfig);
      console.log(`分片上传请求成功，响应:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`分片上传请求失败:`, error);
      throw error;
    }
  }

  /**
   * 取消请求
   */
  createCancelToken() {
    return axios.CancelToken.source();
  }
}
