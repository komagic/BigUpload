from setuptools import setup, find_packages
import os

setup(
    name="bigupload-fastapi",
    version="1.0.0",
    description="大文件上传 FastAPI 包，提供开箱即用的大文件上传功能",
    long_description=open("README.md", "r", encoding="utf-8").read() if os.path.exists("README.md") else "",
    long_description_content_type="text/markdown",
    author="BigUpload Team",
    author_email="team@bigupload.com",
    url="https://github.com/bigupload/bigupload-fastapi",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Framework :: FastAPI",
    ],
    python_requires=">=3.7",
    install_requires=[
        "fastapi>=0.68.0",
        "python-multipart>=0.0.5",
        "aiofiles>=0.7.0",
        "pydantic>=1.8.0",
    ],
    extras_require={
        "dev": [
            "uvicorn[standard]>=0.15.0",
            "pytest>=6.0",
            "pytest-asyncio>=0.15.0",
        ],
    },
    keywords="upload, fastapi, chunk-upload, large-file, async",
    include_package_data=True,
    zip_safe=False,
) 