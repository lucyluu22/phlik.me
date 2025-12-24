# Phlick.me - Comprehensive Test Plan

## Application Overview

Phlick.me is a browser-based peer-to-peer file sharing application that enables secure, anonymous file transfers between devices using WebRTC. The application features:

- **Anonymous Client Setup**: No accounts required—clients are identified locally with user-defined names
- **Two File Sharing Methods**:
  - Direct sharing to linked/trusted clients
  - URL-based sharing via one-time link codes
- **Real-time P2P Transfer**: Files are transferred directly between clients via WebRTC data channels
- **Client Linking**: Devices can be linked using time-limited 4-character codes for trusted connections

## Test Environment Requirements

- **Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Devices**: Desktop and mobile devices for cross-platform testing
- **Network**: Active internet connection for signaling (Ably pub/sub)
- **Local Storage**: IndexedDB support required
- **WebRTC**: Peer connection support required

## Test Scenarios

---

### 1. Client Initialization and Setup

**Seed:** Fresh browser session (no existing local storage)

#### 1.1 Initial Client Setup - Valid Name

**Steps:**

1. Navigate to `http://localhost:5173/` (or production URL)
2. Verify automatic redirect to `/setup` page
3. Observe the "Name This Client" input field is auto-focused
4. Type a valid client name (e.g., "My Desktop PC")
5. Click the "Submit" button

**Expected Results:**

- Setup page displays with heading "Name This Client"
- Input field accepts alphanumeric characters and spaces
- Explanatory text states: "A 'client' represents this specific device..."
- After submit, user is redirected to homepage (`/`)
- Success toast message appears: "[Client Name] is now ready!"
- Main navigation menu becomes visible with three options: Send Files, View Files, Client Settings
- Client name is persisted in localStorage

#### 1.2 Initial Client Setup - Empty Name Validation

**Steps:**

1. Navigate to setup page (fresh browser)
2. Leave the "Name This Client" field empty
3. Click "Submit" button

**Expected Results:**

- Form validation prevents submission
- Input field shows validation error or visual indicator
- User remains on setup page

#### 1.3 Initial Client Setup - Special Characters

**Steps:**

1. Navigate to setup page (fresh browser)
2. Enter client name with special characters: `Test<script>alert('xss')</script>`
3. Click "Submit"

**Expected Results:**

- Client name is sanitized/escaped properly
- No script execution occurs
- Name is stored and displayed safely
- Setup completes successfully

#### 1.4 Return Visit - Already Setup Client

**Steps:**

1. Complete initial setup (scenario 1.1)
2. Close browser
3. Reopen browser and navigate to application homepage

**Expected Results:**

- User is NOT redirected to setup page
- Homepage displays immediately with main navigation
- Previous client name is retained
- Navigation menu is accessible

---

### 2. Linking Two Clients Together

**Seed:** Two separate browser sessions with completed initial setup (Client A and Client B)

#### 2.1 Generate Link Code

**Steps:**

1. On Client A, navigate to "Client Settings" from main menu
2. Verify the "No Connected Clients" heading is displayed
3. Observe the "Enter Link Code" input group (4 separate boxes)
4. Click "Generate Link Code" link

**Expected Results:**

- User is redirected to `/manage/link` page
- A 4-character alphanumeric link code is displayed (e.g., "ADFB")
- Code is displayed prominently with a clickable button/copy functionality
- Explanatory text: "Enter this generated code on the client you wish to connect with. It only works once and has a short expiration time."
- "Done" link is available to return to homepage

#### 2.2 Enter Valid Link Code - Successful Connection

**Steps:**

1. On Client A, generate a link code (follow scenario 2.1)
2. Note the 4-character code displayed
3. On Client B, navigate to "Client Settings"
4. In the "Enter Link Code" section, type the 4 characters from Client A into the four input boxes (one character per box)
5. Observe automatic submission when fourth character is entered

**Expected Results:**

- Each input box accepts exactly one alphanumeric character
- Focus automatically advances to the next box after character entry
- After entering the fourth character, connection process begins automatically
- Success toast/notification appears on both clients
- On Client B: Client A's name appears in the connected clients list
- On Client A: Client B's name appears in the connected clients list
- The link code is consumed and cannot be reused
- Both clients are now in each other's connected clients list

#### 2.3 Enter Invalid Link Code

**Steps:**

1. On Client A, navigate to "Client Settings"
2. Enter a random 4-character code that was not generated: "ZZZZ"

**Expected Results:**

- Error message appears: "Invalid or expired link code"
- Client A remains on the settings page
- No connection is established
- User can try again with a different code

#### 2.4 Reuse Expired Link Code

**Steps:**

1. On Client A, generate a link code
2. Note the code
3. On Client B, enter the code to establish connection (successful)
4. On a third browser (Client C), attempt to enter the same code

**Expected Results:**

- Error message appears: "Invalid or expired link code"
- No connection is established
- Code is single-use and consumed after first successful connection

#### 2.5 Link Code Expiration

**Steps:**

1. On Client A, generate a link code
2. Note the code
3. Wait for expiration time (implementation-dependent, likely 5-10 minutes)
4. On Client B, attempt to enter the expired code

**Expected Results:**

- Error message appears: "Invalid or expired link code"
- No connection is established
- User must generate a fresh link code

#### 2.6 View Connected Clients List

**Steps:**

1. Successfully link Client A and Client B (scenario 2.2)
2. On Client A, navigate to "Client Settings"
3. Observe the connected clients section

**Expected Results:**

- "No Connected Clients" heading is replaced with a list of connections
- Client B's name is displayed in the list
- Each connected client entry shows the client name
- UI provides options to manage the connection (rename, disconnect)

#### 2.7 Disconnect a Linked Client

**Steps:**

1. Successfully link Client A and Client B
2. On Client A, navigate to "Client Settings"
3. Locate Client B in the connected clients list
4. Click "Disconnect" or similar action button for Client B
5. Confirm disconnection if prompted

**Expected Results:**

- Client B is removed from Client A's connected clients list
- Client A is removed from Client B's connected clients list (bidirectional removal)
- Success notification appears
- Both clients can no longer send files directly to each other
- Both clients can re-link using a new link code if desired

#### 2.8 Rename a Connected Client

**Steps:**

1. Successfully link Client A and Client B
2. On Client A, navigate to "Client Settings"
3. Locate Client B in the connected clients list
4. Click "Edit" or "Rename" for Client B's entry
5. Enter a new name: "Bob's Phone"
6. Save the change

**Expected Results:**

- Client B's name is updated to "Bob's Phone" in Client A's list
- The name change is local to Client A only (Client B's self-assigned name remains unchanged)
- Updated name appears when sending files to Client B
- Change persists across browser sessions

---

### 3. Sending Files Via URL

**Seed:** One browser session with completed setup (Client A, "Sender")

#### 3.1 Generate File Sharing URL - Single File

**Steps:**

1. On Client A, navigate to "Send Files"
2. Verify the page displays two options: "Send Via Link" and "Connect Your First Client" (or send to connected client)
3. Click "Send Via Link" button
4. When the file picker dialog opens, select a single test file (e.g., `test-document.pdf`, 500 KB)
5. Observe the URL generation process

**Expected Results:**

- File picker opens with native OS file selection dialog
- After file selection, a unique shareable URL is generated (format: `/files/{publicId}/{linkCode}`)
- URL is displayed prominently with copy functionality
- Explanatory text indicates the URL can be shared with anyone
- The selected file name, size, and type are displayed
- An option to cancel/close is available

#### 3.2 Generate File Sharing URL - Multiple Files

**Steps:**

1. On Client A, navigate to "Send Files"
2. Click "Send Via Link"
3. In the file picker, select multiple files (e.g., 3 images: `photo1.jpg`, `photo2.jpg`, `photo3.png`)
4. Observe the URL generation

**Expected Results:**

- Multiple files can be selected in the file picker (multi-select supported)
- A single shareable URL is generated for all files
- All selected files are listed with names, sizes, and types
- Total size of all files is displayed
- URL can be copied and shared

#### 3.3 Generate File Sharing URL - Large File

**Steps:**

1. On Client A, navigate to "Send Files"
2. Click "Send Via Link"
3. Select a large file (e.g., 100 MB video file)
4. Observe the URL generation

**Expected Results:**

- Large file is accepted without error
- URL is generated successfully
- File size is displayed correctly (e.g., "100 MB")
- No immediate file upload occurs (files are transferred P2P when recipient accesses URL)

#### 3.4 Access File Sharing URL - Successful Download

**Steps:**

1. Complete scenario 3.1 to generate a URL on Client A
2. Copy the generated URL
3. On a separate browser (Client B, "Recipient"), paste and navigate to the URL
4. Observe the file transfer page
5. Click "Download" or equivalent action button for the file

**Expected Results:**

- Recipient (Client B) sees a page with file details: name, size, type, and sender's client name
- WebRTC connection establishes between Client A and Client B
- File transfer progress bar displays during download
- Real-time transfer is shown
- Upon completion, the file can be saved to Client B's device
- File integrity is maintained (checksums match, file opens correctly)
- Sender (Client A) sees transfer progress/status notification

#### 3.5 Access File Sharing URL - Multiple Files Download

**Steps:**

1. Complete scenario 3.2 to generate a URL with 3 files on Client A
2. On Client B, navigate to the URL
3. Observe the file list
4. Click "Download All" (if available) or individually download each file

**Expected Results:**

- All 3 files are listed with individual details
- Option to download all files at once or individually
- Each file transfers with individual progress indicators
- All files download successfully with correct names and content
- Files can be downloaded in any order

#### 3.6 Access File Sharing URL - Connection Failure

**Steps:**

1. Generate a URL on Client A with a file
2. On Client B, navigate to the URL
3. Before transfer completes, close the browser window on Client A (sender goes offline)

**Expected Results:**

- Client B detects the connection loss
- Error message appears: "Connection lost" or "Sender is offline"
- Partial download is handled gracefully (no corrupted file saved)
- Option to retry or return to homepage is provided
- If sender comes back online, retry should resume transfer

#### 3.7 Access File Sharing URL - Expired/Invalid Link

**Steps:**

1. On Client B, navigate to a fabricated/invalid URL: `/files/invalid-public-id/invalid-link-code`

**Expected Results:**

- Error page displays: "No Files Available ;\_;"
- No sensitive information is exposed
- User is provided with a link to return to homepage

#### 3.8 Cancel File Sharing URL

**Steps:**

1. On Client A, generate a file sharing URL
2. Copy the URL
3. On the same page, click "Cancel" or "Close" to dispose of the share
4. On Client B, attempt to navigate to the copied URL

**Expected Results:**

- Client A disposes of the shareable link and stops listening for connections
- URL is invalidated
- Client B receives an error: "Invalid or expired link" when accessing the URL
- Client A can generate a new URL for the same or different files

---

### 4. Sending Files Directly to Linked Client

**Seed:** Two browsers with completed setup and established link (Client A and Client B linked via scenario 2.2)

#### 4.1 Send Single File to Linked Client

**Steps:**

1. On Client A, navigate to "Send Files"
2. Verify Client B appears in the list of connected clients (instead of "Connect Your First Client" prompt)
3. Click on Client B's entry or a "Send to Client B" button
4. When the file picker opens, select a test file: `report.docx` (2 MB)
5. Confirm the send action

**Expected Results:**

- File picker opens for Client A
- After file selection, transfer initiates immediately
- Client B receives a notification/alert that Client A is sending a file
- Client B sees the incoming file details: name, size, sender name
- Transfer progress is displayed on both clients
- Upon completion, the file is saved to Client B's received files (IndexedDB)
- Both clients show success confirmation

#### 4.2 Send Multiple Files to Linked Client

**Steps:**

1. On Client A, navigate to "Send Files"
2. Select Client B as the recipient
3. In the file picker, select multiple files (e.g., 5 images totaling 10 MB)
4. Confirm the send

**Expected Results:**

- All 5 files are queued for transfer
- Files transfer sequentially or in parallel (implementation-dependent)
- Progress for each file or overall progress is displayed
- Client B receives all 5 files successfully
- All files are listed in Client B's "View Files" section

#### 4.3 Send Large File to Linked Client

**Steps:**

1. On Client A, send a large file (e.g., 500 MB video) to Client B

**Expected Results:**

- Transfer begins without error
- Progress indicators show percentage and speed (e.g., "45% - 5 MB/s")
- Estimated time remaining is displayed
- Transfer completes successfully
- Large file is stored correctly in IndexedDB with chunked storage
- File can be retrieved and played/opened on Client B

#### 4.4 Reject Incoming File Transfer

**Steps:**

1. On Client A, send a file to Client B
2. On Client B, when the incoming file notification appears, click "Reject" or "Cancel"

**Expected Results:**

- Transfer is cancelled
- Client A is notified that Client B rejected the transfer
- No partial file is saved on Client B
- Both clients can initiate new transfers

#### 4.5 Send File with No Active Connection

**Steps:**

1. Link Client A and Client B
2. On Client B, close the browser (go offline)
3. On Client A, attempt to send a file to Client B

**Expected Results:**

- Client A detects that Client B is offline
- Error message appears: "Client B is currently offline" or "Unable to connect"
- Option to retry is provided
- No file corruption or hanging state occurs

---

### 5. Viewing, Downloading, and Deleting Received Files

**Seed:** Client B has received files from various sources (via URL and direct send)

#### 5.1 View Received Files List

**Steps:**

1. On Client B, navigate to "View Files"
2. Observe the received files list

**Expected Results:**

- All received files are listed with the following details:
  - File name
  - File size (human-readable format: KB, MB, GB)
  - File type/icon
  - Sender's client name
  - Date/time received (e.g., "Dec 15, 2025, 3:45 PM")
- Files are sorted by most recent first (newest at top)
- Each file entry has action buttons: "Save File" and "Delete File"
- If no files are received, a message displays: "No Files Available ;\_;" with an icon and explanation

#### 5.2 View Received Files - Empty State

**Steps:**

1. On a fresh client (no received files), navigate to "View Files"

**Expected Results:**

- Heading displays: "No Files Available ;\_;" (note the cry emoji, it is the most important here)
- Icon or illustration is shown
- Explanatory text: "Files sent to this client will be listed here."
- "Done" link to return to homepage

#### 5.3 Download Single Received File

**Steps:**

1. On Client B with received files, navigate to "View Files"
2. Locate a specific file in the list: `vacation-photo.jpg`
3. Click the "Save File" button for that file

**Expected Results:**

- File download initiates immediately
- Browser's native download dialog appears (or file saves to default location)
- Downloaded file name matches the original
- File content is intact and can be opened successfully
- File remains in the received files list after download (not removed)

#### 5.4 Download Multiple Received Files

**Steps:**

1. On Client B, navigate to "View Files" with multiple files received
2. Download each file one by one by clicking "Save File" for each entry

**Expected Results:**

- Each file downloads successfully with correct name and content
- Downloads can be initiated sequentially without waiting for previous downloads to complete
- All files remain in the list after downloading

#### 5.5 View File Details (Expandable)

**Steps:**

1. On Client B, navigate to "View Files"
2. Click on a file entry to expand details

**Expected Results:**

- Additional file metadata is displayed:
  - Sender client name
  - Exact received timestamp
  - Delete button
  - Any additional metadata
- Details section can be collapsed by clicking again

#### 5.6 Delete Single Received File

**Steps:**

1. On Client B, navigate to "View Files"
2. Locate a file: `old-document.pdf`
3. Click the "Delete File" button (typically red/danger styled)
4. Confirm deletion if prompted

**Expected Results:**

- The file is removed from the list immediately
- File is deleted from IndexedDB storage
- UI updates to reflect the deletion (file disappears from list)
- If it was the last file, the empty state message appears
- Deletion is permanent and cannot be undone

#### 5.7 Delete Multiple Received Files

**Steps:**

1. On Client B, navigate to "View Files" with multiple files
2. Delete several files one by one

**Expected Results:**

- Each file is deleted successfully
- List updates after each deletion
- No errors occur
- Storage space is freed in IndexedDB

#### 5.8 Download Received File - Large File

**Steps:**

1. Client B has received a large file (e.g., 500 MB video)
2. Navigate to "View Files"
3. Click "Save File" for the large file

**Expected Results:**

- Download initiates successfully
- Large file streams from IndexedDB to download
- Progress indicator is shown
- File downloads completely with correct size
- File is playable/usable after download

#### ~~5.9 Storage Limit Handling~~

**Steps:**

1. On Client B, receive a very large number of files or files totaling near IndexedDB quota limit
2. Attempt to receive an additional file that exceeds the quota

**Expected Results:**

- Error message appears: "Storage limit reached" or similar
- User is prompted to delete old files to make space
- Incoming transfer fails gracefully without corruption
- Clear guidance is provided to free up space

---

## Additional Test Scenarios

### 6. Cross-Browser and Cross-Device Testing

#### 6.1 Chrome to Firefox File Transfer

**Steps:**

1. Set up Client A on Chrome browser
2. Set up Client B on Firefox browser
3. Link the two clients
4. Send a file from Chrome to Firefox

**Expected Results:**

- WebRTC connection establishes successfully
- File transfers without errors
- File is received and stored correctly on Firefox

#### 6.2 Desktop to Mobile File Transfer

**Steps:**

1. Set up Client A on a desktop browser (Chrome/Windows)
2. Set up Client B on a mobile browser (Safari/iOS or Chrome/Android)
3. Link the two clients
4. Send a file from desktop to mobile

**Expected Results:**

- Link code entry works on mobile keyboard
- WebRTC connection establishes
- File transfers and is accessible on mobile device
- Mobile UI is responsive and usable

#### 6.3 Mobile to Desktop File Transfer

**Steps:**

1. Send a photo from mobile device (Client B) to desktop (Client A)

**Expected Results:**

- Mobile file picker allows selecting photos from camera roll
- Transfer completes successfully
- Desktop receives and can download the photo

---

### 7. Edge Cases and Error Handling

#### 7.1 Network Interruption During Transfer

**Steps:**

1. Initiate a large file transfer
2. Mid-transfer, disconnect the network (airplane mode or disable Wi-Fi)
3. Reconnect network after 30 seconds

**Expected Results:**

- Transfer detects the disconnection and pauses
- Error message appears: "Connection lost"
- Upon reconnection, option to retry is available
- Retry resumes the transfer (if supported) or restarts from beginning
- Partial/corrupted files are not saved

#### 7.2 Browser Refresh During Transfer - Sender

**Steps:**

1. On Client A, initiate a file send to Client B
2. While transfer is in progress, refresh the browser on Client A

**Expected Results:**

- Transfer is interrupted
- Client B detects the disconnection
- No corrupted file is saved
- After refresh, Client A can re-initiate the transfer

#### 7.3 Browser Refresh During Transfer - Receiver

**Steps:**

1. On Client A, send a file to Client B
2. While transfer is in progress, refresh the browser on Client B

**Expected Results:**

- Transfer is interrupted on Client B
- No partial file is saved
- Client A detects the disconnection
- Client B can request the file again after refresh

#### 7.4 Browser Tab Close - Sender with Active URL Share

**Steps:**

1. On Client A, generate a file sharing URL
2. Close the browser tab on Client A
3. On Client B, attempt to access the URL

**Expected Results:**

- URL becomes invalid since sender is no longer online
- Client B receives an error: "Sender is offline" or "Link expired"

#### 7.5 Attempt to Send File to Self

**Steps:**

1. On Client A, generate a link code
2. On the same browser (Client A), attempt to enter the link code

**Expected Results:**

- Error message appears: "You cannot connect with your own link code!"
- No connection is established
- Client does not appear in its own connected clients list

#### 7.6 IndexedDB Storage Failure

**Steps:**

1. Simulate IndexedDB failure (browser in private/incognito mode with limited storage, or manually disable IndexedDB)
2. Attempt to receive a file

**Expected Results:**

- Application detects IndexedDB unavailability
- Error message appears: "Storage unavailable" or similar
- User is notified that file receiving is not possible
- Application does not crash

#### 7.7 WebRTC Connection Failure

**Steps:**

1. Configure network/firewall to block WebRTC connections
2. Attempt to send a file

**Expected Results:**

- Connection attempt times out gracefully
- Error message: "Unable to establish connection"
- User is advised to check network/firewall settings
- Application remains functional

---

### 8. Performance and Usability

#### 8.1 Transfer Speed - Optimal Network

**Steps:**

1. On a fast, stable network (e.g., gigabit LAN), transfer a 100 MB file between two clients

**Expected Results:**

- Transfer speed approaches network capability (limited by WebRTC overhead)
- Progress updates smoothly without lag
- Transfer completes in reasonable time

#### 8.2 Transfer Speed - Slow Network

**Steps:**

1. On a slow network (e.g., throttled to 1 Mbps), transfer a 10 MB file

**Expected Results:**

- Transfer speed reflects network limitation
- Progress bar updates accurately
- Estimated time remaining is realistic
- No timeouts or errors due to slow speed

#### 8.3 UI Responsiveness During Transfer

**Steps:**

1. Initiate a large file transfer
2. While transfer is in progress, navigate through the application (visit other pages, open settings, etc.)

**Expected Results:**

- UI remains responsive and does not freeze
- Navigation works normally
- Transfer continues in the background
- Transfer status is accessible from a persistent indicator or notifications

#### 8.4 Multiple Concurrent Transfers

**Steps:**

1. On Client A, send files to Client B, Client C, and Client D simultaneously

**Expected Results:**

- All transfers proceed concurrently
- Progress for each transfer is independently tracked
- No transfer fails due to concurrency
- System resources are managed efficiently

---

### 9. Security and Privacy

#### 9.1 File Content Privacy

**Steps:**

1. Send a confidential document from Client A to Client B
2. Attempt to intercept traffic using network monitoring tools

**Expected Results:**

- File data is encrypted during transfer (WebRTC encryption)
- Intercepted packets do not reveal file content
- No file data is uploaded to or stored on the server

#### 9.2 Link Code Guessing Attack

**Steps:**

1. Attempt to connect to a client by guessing random 4-character link codes (brute force)

**Expected Results:**

- Rate limiting or lockout mechanism prevents brute force attacks
- Invalid attempts are logged or blocked after a threshold
- Valid link codes expire quickly, reducing attack window

#### 9.3 No Account Data Leakage

**Steps:**

1. Complete full user flow (setup, link, send, receive)
2. Inspect browser storage (localStorage, IndexedDB, cookies)
3. Review network requests in browser DevTools

**Expected Results:**

- No personally identifiable information (PII) is stored or transmitted
- Only client names (user-defined) and anonymous IDs are stored
- No tracking cookies or third-party analytics are present (or anonymized)

#### 9.4 XSS Prevention in Client Names

**Steps:**

1. Set a client name with malicious script: `<img src=x onerror=alert('XSS')>`
2. Link with another client
3. Observe the display of the client name

**Expected Results:**

- Client name is sanitized/escaped properly
- No script execution occurs in the UI
- Client name displays as plain text

---

## Test Execution Notes

### Prerequisites

- Local development environment running (`npm run dev`)
- Multiple browsers/devices available for multi-client testing
- Test files prepared (various sizes and types: PDF, images, videos, documents)
- Network conditions can be simulated/throttled
- Browser DevTools accessible for debugging

### Test Data

Prepare the following test files:

- Small file: `test-doc.txt` (10 KB)
- Medium file: `report.pdf` (2 MB)
- Large file: `video.mp4` (100 MB)
- Very large file: `large-video.mp4` (500 MB)
- Multiple small files: 5 images (1 MB each)

### Success Criteria

- All critical user flows complete without errors
- File transfers maintain data integrity (checksums match)
- UI is responsive and intuitive
- Error messages are clear and actionable
- Cross-browser and cross-device compatibility is confirmed
- Security and privacy requirements are met

### Known Limitations / Out of Scope

- Offline mode (application requires network for signaling)
- File synchronization across multiple devices
- File versioning or conflict resolution
- Group file sharing (more than two clients simultaneously)

---

## Test Coverage Summary

| **Feature**                        | **Scenarios** | **Priority** |
| ---------------------------------- | ------------- | ------------ |
| Client Initialization and Setup    | 4             | High         |
| Linking Two Clients Together       | 8             | High         |
| Sending Files Via URL              | 8             | High         |
| Sending Files to Linked Client     | 6             | High         |
| Viewing/Downloading/Deleting Files | 9             | High         |
| Cross-Browser/Cross-Device         | 3             | Medium       |
| Edge Cases and Error Handling      | 7             | High         |
| Performance and Usability          | 4             | Medium       |
| Security and Privacy               | 4             | High         |
| **Total**                          | **53**        |              |

---

## Revision History

| **Version** | **Date**     | **Author**   | **Changes**                |
| ----------- | ------------ | ------------ | -------------------------- |
| 1.0         | Dec 15, 2025 | Test Planner | Initial test plan creation |
