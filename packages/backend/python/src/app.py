import os
import json
import shutil
import hashlib
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 启用CORS

# 配置上传目录
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
TEMP_FOLDER = os.path.join(UPLOAD_FOLDER, 'temp')
CHUNK_SIZE = 2 * 1024 * 1024  # 2MB

# 确保目录存在
Path(UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)
Path(TEMP_FOLDER).mkdir(parents=True, exist_ok=True)

# 文件上传配置
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['TEMP_FOLDER'] = TEMP_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024 * 1024  # 5GB上传限制

# 文件元数据存储 (实际生产环境应该使用数据库)
file_metadata = {}

@app.route('/upload-chunk', methods=['POST'])
def upload_chunk():
    """
    上传分片接口
    """
    try:
        if 'chunk' not in request.files:
            return jsonify({'success': False, 'message': '没有找到文件分片'}), 400
        
        chunk = request.files['chunk']
        file_id = request.form.get('fileId')
        file_name = request.form.get('fileName')
        chunk_index = int(request.form.get('chunkIndex', 0))
        chunk_total = int(request.form.get('chunkTotal', 1))
        file_hash = request.form.get('fileHash')
        
        if not all([file_id, file_name, file_hash]):
            return jsonify({'success': False, 'message': '参数不完整'}), 400
        
        # 确保文件ID目录存在
        file_temp_dir = os.path.join(app.config['TEMP_FOLDER'], file_id)
        Path(file_temp_dir).mkdir(exist_ok=True)
        
        # 保存分片
        chunk_file_path = os.path.join(file_temp_dir, f'{chunk_index}')
        chunk.save(chunk_file_path)
        
        # 更新文件元数据
        if file_id not in file_metadata:
            file_metadata[file_id] = {
                'fileName': file_name,
                'fileHash': file_hash,
                'chunkTotal': chunk_total,
                'uploadedChunks': []
            }
        
        # 添加已上传的分片索引
        if chunk_index not in file_metadata[file_id]['uploadedChunks']:
            file_metadata[file_id]['uploadedChunks'].append(chunk_index)
        
        return jsonify({
            'success': True, 
            'fileId': file_id,
            'message': f'分片 {chunk_index}/{chunk_total} 上传成功'
        })
    
    except Exception as e:
        print(f"上传分片错误: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/merge-chunks', methods=['POST'])
def merge_chunks():
    """
    合并分片接口
    """
    try:
        # 获取请求数据
        data = request.json
        file_id = data.get('fileId')
        file_name = data.get('fileName')
        file_hash = data.get('fileHash')
        chunk_total = data.get('chunkTotal')
        
        if not all([file_id, file_name, file_hash, chunk_total]):
            return jsonify({'success': False, 'message': '参数不完整'}), 400
        
        # 获取文件元数据
        metadata = file_metadata.get(file_id)
        if not metadata:
            return jsonify({'success': False, 'message': '文件元数据不存在'}), 404
        
        # 检查所有分片是否已上传
        uploaded_chunks = metadata['uploadedChunks']
        if len(uploaded_chunks) != chunk_total:
            return jsonify({
                'success': False, 
                'message': f'分片不完整: {len(uploaded_chunks)}/{chunk_total}'
            }), 400
        
        # 安全处理文件名
        safe_filename = secure_filename(file_name)
        file_ext = os.path.splitext(safe_filename)[1]
        target_filename = f"{file_hash}{file_ext}"  # 使用哈希作为文件名
        target_path = os.path.join(app.config['UPLOAD_FOLDER'], target_filename)
        
        # 合并文件
        with open(target_path, 'wb') as target_file:
            # 按顺序读取所有分片并写入目标文件
            for i in range(chunk_total):
                chunk_path = os.path.join(app.config['TEMP_FOLDER'], file_id, str(i))
                with open(chunk_path, 'rb') as chunk_file:
                    target_file.write(chunk_file.read())
        
        # 验证合并后的文件哈希 - 使用 SHA-256
        with open(target_path, 'rb') as f:
            file_data = f.read()
            merged_file_hash = hashlib.sha256(file_data).hexdigest()
        
        # 哈希不匹配，删除合并的文件
        if merged_file_hash != file_hash:
            os.remove(target_path)
            return jsonify({'success': False, 'message': '文件哈希验证失败'}), 400
        
        # 清理临时分片
        temp_dir = os.path.join(app.config['TEMP_FOLDER'], file_id)
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        # 生成访问URL
        file_url = f"/files/{target_filename}"
        
        # 更新元数据
        file_metadata[file_id].update({
            'filePath': target_path,
            'fileUrl': file_url,
            'status': 'completed'
        })
        
        return jsonify({
            'success': True, 
            'fileId': file_id,
            'url': file_url,
            'message': '文件合并成功'
        })
    
    except Exception as e:
        print(f"合并分片错误: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/verify', methods=['POST'])
def verify_file():
    """
    验证文件是否已存在（秒传功能）
    """
    try:
        data = request.json
        file_hash = data.get('fileHash')
        file_name = data.get('fileName')
        file_size = data.get('fileSize')
        file_id = data.get('fileId')
        
        if not all([file_hash, file_name]):
            return jsonify({'success': False, 'message': '参数不完整'}), 400
        
        # 安全处理文件名
        safe_filename = secure_filename(file_name)
        file_ext = os.path.splitext(safe_filename)[1]
        target_filename = f"{file_hash}{file_ext}"
        target_path = os.path.join(app.config['UPLOAD_FOLDER'], target_filename)
        
        # 检查文件是否存在
        if os.path.exists(target_path):
            file_url = f"/files/{target_filename}"
            return jsonify({
                'exists': True,
                'fileId': file_id,
                'url': file_url,
                'message': '文件已存在',
                'success': True,
                'finish': True
            })
        
        # 检查是否有未完成的上传
        for fid, metadata in file_metadata.items():
            if metadata.get('fileHash') == file_hash:
                # 返回已上传的分片信息
                return jsonify({
                    'exists': False,
                    'fileId': fid,
                    'uploadedChunks': metadata.get('uploadedChunks', []),
                    'message': '发现未完成的上传',
                    'success': True,
                    'finish': False
                })
        
        # 没有找到文件
        return jsonify({
            'exists': False,
            'fileId': file_id,
            'uploadedChunks': [],
            'message': '文件不存在',
            'success': True,
            'finish': False
        })
    
    except Exception as e:
        print(f"验证文件错误: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/files/<filename>')
def get_file(filename):
    """
    获取上传的文件
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/')
def index():
    """
    服务根路径
    """
    return jsonify({
        'name': 'FastUploader Python Backend',
        'version': '1.0.0',
        'status': 'running'
    })

@app.route('/health')
def health():
    """
    健康检查端点 (保持兼容性)
    """
    return jsonify({
        'name': 'FastUploader Python Backend',
        'version': '1.0.0',
        'status': 'running'
    })

if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=PORT, debug=True) 