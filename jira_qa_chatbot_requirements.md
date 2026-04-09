# Requirement Document - Jira QA Chat Bot

## 1. Overview

Project ini bertujuan untuk membuat chatbot yang dapat membantu QA
Engineer mengecek status task di Jira melalui Google Chat.

## 2. Objectives

-   Mempermudah monitoring task tanpa membuka Jira
-   Menyediakan informasi task berdasarkan sprint aktif
-   Mendukung workflow QA

## 3. Scope

Bot akan: - Terintegrasi dengan Google Chat - Mengambil data dari Jira
API - Menampilkan task berdasarkan status tertentu

## 4. Functional Requirements

### 4.1 User Command

-   `cek task` → menampilkan semua task pada sprint aktif
-   `task testing` → menampilkan task dengan status TESTING
-   `task done` → menampilkan task DONE

### 4.2 Jira Integration

-   Menggunakan Jira REST API
-   Authentication menggunakan API Token
-   Query menggunakan JQL:

```{=html}
<!-- -->
```
    assignee = currentUser() AND sprint in openSprints()

### 4.3 Filtering

Status yang ditampilkan: - IN PROGRESS - CODE REVIEW - TESTING -
FEEDBACK - TEST COMPLETE - DONE

### 4.4 Response Format

Bot akan menampilkan: - Task Key - Status - Sprint Name

## 5. Non-Functional Requirements

-   Response time \< 3 detik
-   Secure API Token (.env)
-   High availability (deploy di cloud)

## 6. Tech Stack

-   Backend: Node.js (Express)
-   Integration: Google Chat API
-   Jira API
-   Hosting: Railway / Render

## 7. Future Enhancement

-   Notifikasi harian
-   Summary task per status
-   Multi-user support
