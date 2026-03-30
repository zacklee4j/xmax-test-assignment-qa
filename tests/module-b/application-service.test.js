/**
 * ApplicationService.createApplication 分支覆盖（Module B 任务 2）
 * @jest-environment node
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '../..')
const jobRoot = path.join(repoRoot, 'job-service')

describe('ApplicationService.createApplication', () => {
    let ApplicationService
    let findBySmartIdMock
    let jobApplicationFindOneMock
    let jobPostFindByIdAndUpdateMock
    let shadowFindOneAndUpdateMock
    let resumeGetUserLatestMock
    let JobApplicationMock

    const jobOid = new mongoose.Types.ObjectId()
    const fakeJob = { _id: jobOid, jobId: 'job_20250101_abcd1234' }

    beforeEach(async () => {
        jest.resetModules()
        findBySmartIdMock = jest.fn().mockResolvedValue(fakeJob)
        jobApplicationFindOneMock = jest.fn()
        jobPostFindByIdAndUpdateMock = jest.fn().mockResolvedValue({})
        shadowFindOneAndUpdateMock = jest.fn().mockResolvedValue({})
        resumeGetUserLatestMock = jest.fn().mockResolvedValue(null)

        await jest.unstable_mockModule(path.join(jobRoot, 'src/utils/dbQueryHelper.js'), () => ({
            findBySmartId: (...args) => findBySmartIdMock(...args),
            updateBySmartId: jest.fn(),
            findBySmartIdOrThrow: jest.fn(),
            isMongoObjectId: jest.fn(() => false),
        }))

        JobApplicationMock = jest.fn(function (data) {
            this._id = new mongoose.Types.ObjectId()
            Object.assign(this, data)
            this.statusHistory = data.statusHistory ? [...data.statusHistory] : []
            this.metadata = data.metadata || {}
            this.save = jest.fn().mockImplementation(() => Promise.resolve(this))
        })
        JobApplicationMock.findOne = (...args) => jobApplicationFindOneMock(...args)

        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/JobApplication.js'), () => ({
            default: JobApplicationMock,
        }))

        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/JobPost.js'), () => ({
            default: {
                findByIdAndUpdate: (...args) => jobPostFindByIdAndUpdateMock(...args),
            },
        }))

        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/InterviewAppointment.js'), () => ({
            default: {},
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/ManualInterviewRating.js'), () => ({
            default: {},
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/ShadowApplication.js'), () => ({
            default: {
                findOneAndUpdate: (...args) => shadowFindOneAndUpdateMock(...args),
            },
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/models/ApplicationUserAction.js'), () => ({
            default: {},
        }))

        await jest.unstable_mockModule(path.join(jobRoot, 'src/services/integration/UserCenterService.js'), () => ({
            default: {},
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/services/integration/ResumeService.js'), () => ({
            default: {
                getUserLatestResume: (...args) => resumeGetUserLatestMock(...args),
            },
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/services/integration/EvaluationService.js'), () => ({
            default: {},
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/services/integration/NotificationService.js'), () => ({
            default: {},
        }))
        await jest.unstable_mockModule(path.join(jobRoot, 'src/services/JobCollaboratorService.js'), () => ({
            default: {},
        }))

        const mod = await import(path.join(jobRoot, 'src/services/ApplicationService.js'))
        ApplicationService = mod.default
    })

    it('第一次调用：创建 submitting，且不为 screening 统计递增 JobPost', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        jobApplicationFindOneMock.mockResolvedValue(null)

        const app = await ApplicationService.createApplication({
            jobId: fakeJob.jobId,
            candidateId: 'cand-11111111-1111-1111-1111-111111111111',
            hasResume: false,
            hasAssessment: false,
        })

        expect(app.status).toBe(APPLICATION_STATUS.SUBMITTING)
        expect(JobApplicationMock).toHaveBeenCalled()
        expect(jobPostFindByIdAndUpdateMock).not.toHaveBeenCalled()
    })

    it('第二次调用：submitting + 简历与评估满足时更新为 submitted，且不触发 stats 递增', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        const existing = {
            _id: new mongoose.Types.ObjectId(),
            status: APPLICATION_STATUS.SUBMITTING,
            metadata: {},
            statusHistory: [],
            save: jest.fn().mockResolvedValue(true),
        }
        jobApplicationFindOneMock.mockResolvedValue(existing)

        await ApplicationService.createApplication({
            jobId: fakeJob.jobId,
            candidateId: 'cand-22222222-2222-2222-2222-222222222222',
            resumeId: 'resume-1',
            hasResume: true,
            hasAssessment: true,
        })

        expect(existing.status).toBe(APPLICATION_STATUS.SUBMITTED)
        expect(existing.save).toHaveBeenCalled()
        expect(jobPostFindByIdAndUpdateMock).not.toHaveBeenCalled()
    })

    it('已存在非 submitting 申请时抛出 DUPLICATE_APPLICATION', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        jobApplicationFindOneMock.mockResolvedValue({
            status: APPLICATION_STATUS.SUBMITTED,
            save: jest.fn(),
        })

        await expect(
            ApplicationService.createApplication({
                jobId: fakeJob.jobId,
                candidateId: 'cand-33333333-3333-3333-3333-333333333333',
            }),
        ).rejects.toMatchObject({ code: 3010 })
    })

    it('hasResume=false 但提供 resumeId 时 resolvedHasResume 为 true，可进入 submitted', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        const existing = {
            _id: new mongoose.Types.ObjectId(),
            status: APPLICATION_STATUS.SUBMITTING,
            metadata: {},
            statusHistory: [],
            save: jest.fn().mockResolvedValue(true),
        }
        jobApplicationFindOneMock.mockResolvedValue(existing)

        await ApplicationService.createApplication({
            jobId: fakeJob.jobId,
            candidateId: 'cand-44444444-4444-4444-4444-444444444444',
            hasResume: false,
            resumeId: 'resume-xyz',
            hasAssessment: true,
        })

        expect(existing.status).toBe(APPLICATION_STATUS.SUBMITTED)
    })

    it('hasResume=false 且无 resumeId 时保持 submitting', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        const existing = {
            _id: new mongoose.Types.ObjectId(),
            status: APPLICATION_STATUS.SUBMITTING,
            metadata: {},
            statusHistory: [],
            save: jest.fn().mockResolvedValue(true),
        }
        jobApplicationFindOneMock.mockResolvedValue(existing)

        await ApplicationService.createApplication({
            jobId: fakeJob.jobId,
            candidateId: 'cand-55555555-5555-5555-5555-555555555555',
            hasResume: false,
            hasAssessment: true,
        })

        expect(existing.status).toBe(APPLICATION_STATUS.SUBMITTING)
    })

    it('candidateEmail 存在时 ResumeService 抛错仍完成申请创建（非阻塞）', async () => {
        const { APPLICATION_STATUS } = await import(path.join(jobRoot, 'src/constants/application_status.js'))
        jobApplicationFindOneMock.mockResolvedValue(null)
        resumeGetUserLatestMock.mockRejectedValue(new Error('resume service down'))

        const app = await ApplicationService.createApplication({
            jobId: fakeJob.jobId,
            candidateId: 'cand-66666666-6666-6666-6666-666666666666',
            candidateEmail: 'a@example.com',
            hasResume: false,
            hasAssessment: false,
        })

        expect(app.status).toBe(APPLICATION_STATUS.SUBMITTING)
    })
})
